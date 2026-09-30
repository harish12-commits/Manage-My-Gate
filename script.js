const fs = require('fs');
const files = [
  'mobile/mobile-app/app/(auth)/login.tsx',
  'mobile/mobile-app/app/(resident)/all-features.tsx',
  'mobile/mobile-app/components/dashboard/DashboardBackground.tsx',
  'mobile/mobile-app/components/feedback/GlobalNotificationPresenter.tsx',
  'mobile/mobile-app/components/forms/SearchBar.tsx',
  'mobile/mobile-app/components/forms/TextInput.tsx',
  'mobile/mobile-app/components/layout/KeyboardAwareScrollView.tsx',
  'mobile/mobile-app/components/ui/AppBackground.tsx',
  'mobile/mobile-app/components/ui/input.tsx',
  'mobile/mobile-app/src/features/auth/components/AppleSignInButton.tsx'
];
for(const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let modified = false;

  // Convert pointerEvents="none" to style={{ pointerEvents: 'none' }}
  c = c.replace(/<([^>]+)\spointerEvents="([^"]+)"([^>]*)>/g, (match, p1, p2, p3) => {
    modified = true;
    if (match.includes('style={[')) {
      // It has an array style
      return `<${p1}${p3}>`.replace('style={[', `style={[{ pointerEvents: '${p2}' }, `);
    } else if (match.includes('style={{')) {
      // It has an object style
      return `<${p1}${p3}>`.replace('style={{', `style={{ pointerEvents: '${p2}', `);
    } else if (match.includes('style={')) {
      // It has a dynamic style
      return `<${p1}${p3}>`.replace('style={', `style={[{ pointerEvents: '${p2}' }, `).replace('}', ']}');
    } else {
      // No style prop
      return `<${p1} style={{ pointerEvents: '${p2}' }}${p3}>`;
    }
  });

  // Convert pointerEvents={...} to style={{ pointerEvents: ... }}
  c = c.replace(/<([^>]+)\spointerEvents={([^}]+)}([^>]*)>/g, (match, p1, p2, p3) => {
    modified = true;
    if (match.includes('style={[')) {
      // It has an array style
      return `<${p1}${p3}>`.replace('style={[', `style={[{ pointerEvents: ${p2} }, `);
    } else if (match.includes('style={{')) {
      // It has an object style
      return `<${p1}${p3}>`.replace('style={{', `style={{ pointerEvents: ${p2}, `);
    } else if (match.includes('style={')) {
      // It has a dynamic style
      return `<${p1}${p3}>`.replace('style={', `style={[{ pointerEvents: ${p2} }, `).replace('}', ']}');
    } else {
      // No style prop
      return `<${p1} style={{ pointerEvents: ${p2} }}${p3}>`;
    }
  });

  if (modified) {
    fs.writeFileSync(f, c);
    console.log('Modified', f);
  }
}
