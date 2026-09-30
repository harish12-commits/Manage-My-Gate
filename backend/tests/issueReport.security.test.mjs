/**
 * Issue report security hardening — database-free unit tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { tenantContext } from '../src/middlewares/tenant.middleware.js';
import { escapeHtml } from '../src/utils/email.service.js';
import roleService, { RESERVED_PLATFORM_ROLE_NAMES } from '../src/features/role/role.services.js';
import organizationService from '../src/features/organization/organization.services.js';
import issueReportConfigService, { SINGLE_EMAIL_REGEX } from '../src/features/issueReportConfig/issueReportConfig.service.js';
import { ATTACHMENT_FILENAME_PATTERN } from '../src/features/issueReport/middlewares/upload.middleware.js';
import { createReportRules, queryPlatformReportsRules } from '../src/features/issueReport/issueReport.validator.js';
import { reportSubmitLimiter, testEmailLimiter } from '../src/middlewares/rateLimiter.middleware.js';

const runTenantPlatformGuard = (user) =>
  new Promise((resolve) => {
    const req = { user, headers: {} };
    tenantContext({ requirePlatformContext: true })(req, {}, (err) => resolve({ err, req }));
  });

const runRules = async (rules, req) => {
  for (const rule of rules) await rule.run(req);
  return validationResult(req);
};

describe('Platform context is decided by the isPlatform flag, not the role name', () => {
  it('rejects a community user whose role is named like a platform role', async () => {
    for (const role of ['Super Admin', 'Platform Admin', 'Platform Super Admin', 'SUPER_ADMIN', 'PLATFORM_ADMIN']) {
      const { err } = await runTenantPlatformGuard({ id: 'u1', role, isPlatform: false, orgId: 'org1' });
      assert.equal(err?.statusCode, 403, `role ${role} must not grant platform access`);
    }
  });

  it('rejects a role-named user when isPlatform is missing entirely', async () => {
    const { err } = await runTenantPlatformGuard({ id: 'u1', role: 'Platform Super Admin', orgId: 'org1' });
    assert.equal(err?.statusCode, 403);
  });

  it('admits a user from the platform organisation', async () => {
    const { err, req } = await runTenantPlatformGuard({ id: 'u1', role: 'Any', isPlatform: true, orgId: 'org1' });
    assert.equal(err, undefined);
    assert.equal(req.tenant.isPlatform, true);
  });
});

describe('Reserved platform role names', () => {
  const originalGetOrg = organizationService.getOrganizationById;
  const restore = () => {
    organizationService.getOrganizationById = originalGetOrg;
  };

  it('blocks reserved names (any casing/spacing) in a community organisation', async () => {
    organizationService.getOrganizationById = async () => ({ isPlatform: false });
    try {
      for (const name of ['Super Admin', 'platform super admin', '  Platform Admin  ', 'SUPER_ADMIN']) {
        await assert.rejects(() => roleService.assertRoleNameAllowed(name, 'org1'), { statusCode: 403 });
      }
    } finally {
      restore();
    }
  });

  it('allows reserved names inside the platform organisation', async () => {
    organizationService.getOrganizationById = async () => ({ isPlatform: true });
    try {
      await roleService.assertRoleNameAllowed('Super Admin', 'platformOrg');
    } finally {
      restore();
    }
  });

  it('allows ordinary names without looking up the organisation', async () => {
    organizationService.getOrganizationById = async () => {
      throw new Error('should not be called');
    };
    try {
      await roleService.assertRoleNameAllowed('Community Admin', 'org1');
    } finally {
      restore();
    }
    assert.ok(RESERVED_PLATFORM_ROLE_NAMES.includes('super admin'));
  });
});

describe('Issue report email HTML escaping', () => {
  it('neutralises markup, quotes and ampersands', () => {
    const out = escapeHtml('<a href="https://evil.test" onclick=\'x()\'>Reset & login</a>');
    assert.equal(
      out,
      '&lt;a href=&quot;https://evil.test&quot; onclick=&#39;x()&#39;&gt;Reset &amp; login&lt;/a&gt;'
    );
  });

  it('handles null, undefined and numbers', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '42');
  });
});

describe('Config email validation accepts exactly one plain address', () => {
  it('accepts normal addresses', () => {
    for (const ok of ['support@platform.com', 'a.b+tag@sub.example.co.in']) {
      assert.ok(SINGLE_EMAIL_REGEX.test(ok), ok);
    }
  });

  it('rejects lists, display names and header-injection attempts', () => {
    for (const bad of [
      'a@b.com,c@d.com',
      'a@b.com;c@d.com',
      'a@b.com c@d.com',
      'Name <a@b.com>',
      'a@b.com\r\nBcc: x@y.com',
      '"a"@b.com',
      'no-at-sign.com',
    ]) {
      assert.ok(!SINGLE_EMAIL_REGEX.test(bad), bad);
    }
  });

  it('updateConfig and sendTestEmail reject invalid addresses before touching SMTP or the DB', async () => {
    await assert.rejects(() => issueReportConfigService.updateConfig('a@b.com,c@d.com', 'u1'), { statusCode: 400 });
    await assert.rejects(() => issueReportConfigService.sendTestEmail('x@y.com\r\nBcc: z@z.com'), { statusCode: 400 });
  });
});

describe('Attachment file names', () => {
  it('accepts generated and legacy names only', () => {
    assert.ok(ATTACHMENT_FILENAME_PATTERN.test('rep-3f2b8c1e-9a4d-4b6e-8f1a-2c3d4e5f6a7b.jpg'));
    assert.ok(ATTACHMENT_FILENAME_PATTERN.test('rep-1790245976363-882271521.png'));
  });

  it('rejects traversal and foreign names', () => {
    for (const bad of ['../../.env', 'rep-abc/def.jpg', 'evil.jpg', 'rep-12345678.exe', 'rep-1234567.jpg', 'rep-..%2f..%2fx.jpg']) {
      assert.ok(!ATTACHMENT_FILENAME_PATTERN.test(bad), bad);
    }
  });
});

describe('Validators restrict client-controlled values', () => {
  it('rejects an unknown sortBy and sortOrder', async () => {
    const res = await runRules(queryPlatformReportsRules, { query: { sortBy: 'reporter.email', sortOrder: 'sideways' } });
    const fields = res.array().map((e) => e.path);
    assert.ok(fields.includes('sortBy'));
    assert.ok(fields.includes('sortOrder'));
  });

  it('accepts allowed sorts', async () => {
    const res = await runRules(queryPlatformReportsRules, { query: { sortBy: 'createdAt', sortOrder: 'asc' } });
    assert.equal(res.isEmpty(), true);
  });

  it('rejects an unknown report source', async () => {
    const res = await runRules(createReportRules, {
      body: {
        reportType: 'BUG',
        feature: 'OTHER',
        title: 'Something broke',
        description: 'It really broke badly',
        source: '<script>',
      },
    });
    assert.ok(res.array().some((e) => e.path === 'source'));
  });
});

describe('Rate limiters', () => {
  it('are exported as middleware functions', () => {
    assert.equal(typeof reportSubmitLimiter, 'function');
    assert.equal(typeof testEmailLimiter, 'function');
  });
});
