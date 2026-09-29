import React, { useEffect, useMemo } from 'react';
import SimpleBar from 'simplebar-react';
import { Icon } from '@iconify/react';
import FullLogo from '../../shared/logo/FullLogo';
import { Link, useLocation } from 'react-router';
import { useTheme } from 'src/components/provider/theme-provider';
import { AMLogo, AMMenu, AMMenuItem, AMSidebar, AMSubmenu } from 'tailwind-sidebar';
import 'tailwind-sidebar/styles.css';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCurrentWorkspace } from 'src/features/workspace/store/workspaceSlice.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useAuth } from 'src/features/auth/hooks/useAuth.js';

interface SidebarItemType {
  heading?: string
  id?: number | string
  name?: string
  title?: string
  icon?: string
  url?: string
  requiredPermission?: string | string[]
  requirePlatform?: boolean
  children?: SidebarItemType[]
  disabled?: boolean
  isPro?: boolean
}

const renderSidebarItems = (
  items: SidebarItemType[],
  currentPath: string,
  onClose?: () => void,
  isSubItem: boolean = false,
) => {
  return items.map((item) => {
    const isSelected = currentPath === item?.url;
    const IconComp = item.icon || null;

    const iconElement = IconComp ? (
      <Icon icon={IconComp} height={21} width={21} />
    ) : (
      <Icon icon={'ri:checkbox-blank-circle-line'} height={9} width={9} />
    );

    // Heading
    if (item.heading) {
      return (
        <div className="mb-1" key={item.heading}>
          <AMMenu
            subHeading={item.heading}
            ClassName="hide-menu leading-21 text-sidebar-foreground font-bold uppercase text-xs dark:text-sidebar-foreground"
          />
        </div>
      );
    }

    // Submenu
    if (item.children?.length) {
      return (
        <AMSubmenu
          key={item.id}
          icon={iconElement}
          title={item.name}
          ClassName="mt-0.5 text-sidebar-foreground dark:text-sidebar-foreground"
        >
          {renderSidebarItems(item.children, currentPath, onClose, true)}
        </AMSubmenu>
      );
    }

    // Regular menu item
    const linkTarget = item.url?.startsWith('https') ? '_blank' : '_self';

    const itemClassNames = isSubItem
      ? `mt-0.5 text-sidebar-foreground dark:text-sidebar-foreground !hover:bg-transparent ${
          isSelected ? '!bg-transparent !text-primary' : ''
        }`
      : `mt-0.5 text-sidebar-foreground dark:text-sidebar-foreground`;

    return (
      <div onClick={onClose} key={item.id}>
        <AMMenuItem
          key={item.id}
          icon={iconElement}
          isSelected={isSelected}
          link={item.url || undefined}
          to={item.url || undefined}
          target={linkTarget}
          badge={!!item.isPro}
          badgeColor="bg-lightsecondary"
          badgeTextColor="text-secondary"
          disabled={item.disabled}
          badgeContent={item.isPro ? 'Pro' : undefined}
          component={Link}
          className={`${itemClassNames}`}
        >
          <span className="truncate flex-1">{item.title || item.name}</span>
        </AMMenuItem>
      </div>
    );
  });
};

const SidebarLayout = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const { theme } = useTheme();
  
  const { checkPermission } = useAuth();
  const isPlatform = useSelector((state: any) => state.workspace?.isPlatform || false);

  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: any) => state.auth?.isAuthenticated);
  const currentWorkspaceModules = useSelector((state: any) => state.workspace?.currentWorkspaceModules || []);

  const isPermitted = (item: any) => {
    if (item.requirePlatform && !isPlatform) {
      return false;
    }

    if (isPlatform && (item.url === '/admin/amenities/dashboard')) {
      return false;
    }

    if (!item.requiredPermission) {
      return true;
    }

    if (Array.isArray(item.requiredPermission)) {
      return isPlatform || item.requiredPermission.some((perm: string) => checkPermission(perm));
    }

    return isPlatform || checkPermission(item.requiredPermission);
  };

  useEffect(() => {
    // We fetch the current workspace config ONLY if we are authenticated, not a platform admin, and we haven't loaded them yet.
    // (If the workspace changes, we dispatch fetchCurrentWorkspace elsewhere).
    if (isAuthenticated && !isPlatform && currentWorkspaceModules.length === 0) {
      dispatch(fetchCurrentWorkspace() as any);
    }
  }, [isAuthenticated, isPlatform, currentWorkspaceModules.length, dispatch]);

  const filteredSidebarContent = useMemo(() => {
    const baseNav: any[] = [
      {
        heading: 'Home',
        children: [
          {
            name: 'Dashboard',
            icon: 'solar:widget-2-linear',
            id: 'dashboard-static',
            url: '/dashboard',
          },
        ],
      },
    ];

    if (isPlatform) {
      baseNav.push({
        heading: 'Platform Admin',
        children: [
          {
            name: 'Organization Manager',
            icon: 'solar:city-linear',
            id: 'org-static',
            url: '/super-admin/organizations',
            requirePlatform: true,
          },
          {
            name: 'Audit Logs',
            icon: 'solar:clipboard-list-linear',
            id: 'audit-static',
            url: '/super-admin/audit-logs',
            requirePlatform: true,
          },
          {
            name: 'Manage Workspaces',
            icon: 'solar:box-linear',
            id: 'global-modules-static',
            url: '/super-admin/modules',
            requirePlatform: true,
          }
        ],
      });
    } else {
      const dynamicChildren = currentWorkspaceModules
        .filter((mp: any) => mp.isEnabled && mp.visibleInSidebar && mp.moduleId?.status === 'Active')
        .map((mp: any) => ({
          name: mp.moduleId.displayName || mp.moduleId.name,
          icon: mp.moduleId.sidebarIcon || 'solar:box-linear',
          id: mp.moduleId._id,
          url: mp.moduleId.routePath,
        }));

      if (dynamicChildren.length > 0) {
        baseNav.push({
          heading: 'Workspace Modules',
          children: dynamicChildren,
        });
      }
    }

    // Still map over them to filter out any requirePlatform items if isPlatform is false (though we handle this in construction)
    const filterSection = (section: any) => {
      const filteredChildren = (section.children || []).filter(isPermitted);
      if (filteredChildren.length === 0) {
        return null;
      }
      return { ...section, children: filteredChildren };
    };

    return baseNav.map(filterSection).filter(Boolean);
  }, [currentWorkspaceModules, isPlatform]);

  // Only allow "light" or "dark" for AMSidebar
  const sidebarMode = theme === 'light' || theme === 'dark' ? theme : undefined;

  return (
    <AMSidebar
      collapsible="none"
      animation={true}
      showProfile={false}
      width={'270px'}
      showTrigger={false}
      mode={sidebarMode}
      className="fixed left-0 top-0 border border-border dark:border-border bg-sidebar dark:bg-sidebar z-10 h-screen"
    >
      {/* Logo */}
      <div className="px-6 flex items-center brand-logo overflow-hidden">
        <AMLogo component={Link} href="/" img="">
          <FullLogo />
        </AMLogo>
      </div>

      {/* Sidebar items */}
      <SimpleBar className="h-[calc(100vh-100px)]">
        <div className="px-6">
          {filteredSidebarContent.map((section: any, index: number) => (
            <div key={index}>
              {renderSidebarItems(
                [
                  ...(section.heading ? [{ heading: section.heading }] : []),
                  ...(section.children || []),
                ],
                pathname,
                onClose,
              )}
            </div>
          ))}
        </div>
      </SimpleBar>
    </AMSidebar>
  );
};

export default SidebarLayout;
