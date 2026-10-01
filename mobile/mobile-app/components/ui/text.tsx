import { cn } from '../../lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';
import i18n, { I18nContext } from '../../src/utils/i18n';

const textVariants = cva(
  cn(
    'text-foreground text-sm font-normal text-left',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-3xl font-extrabold tracking-tight text-left',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-border border-b pb-1.5 text-2xl font-bold tracking-tight text-left',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-xl font-bold tracking-tight text-left', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-lg font-bold tracking-tight text-left', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-2 text-sm leading-relaxed text-left',
        blockquote: 'mt-3 border-l-2 pl-3 italic sm:pl-6 text-left',
        code: cn(
          'bg-muted relative rounded px-[0.35rem] py-[0.2rem] font-mono text-xs font-semibold'
        ),
        lead: 'text-muted-foreground text-base leading-relaxed text-left',
        large: 'text-base font-semibold tracking-tight text-left',
        small: 'text-xs font-medium leading-tight text-left',
        muted: 'text-muted-foreground text-xs leading-normal text-left',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function translateChildren(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    const translated = i18n.translateText(node);
    if (translated === node) return node;

    const leadingWhitespace = node.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = node.match(/\s*$/)?.[0] || '';
    return `${leadingWhitespace}${translated.trim()}${trailingWhitespace}`;
  }
  if (Array.isArray(node)) {
    return React.Children.map(node, (child) => translateChildren(child));
  }
  return node;
}

function Text({
  className,
  asChild = false,
  variant = 'default',
  children,
  style,
  skipTranslate,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
    skipTranslate?: boolean;
    noTranslate?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;

  const i18nCtx = React.useContext(I18nContext);
  const [fallbackLang, setFallbackLang] = React.useState(() => i18n.getCurrentLanguage());

  React.useEffect(() => {
    if (!i18nCtx) {
      return i18n.subscribe((newLang) => setFallbackLang(newLang));
    }
  }, [i18nCtx]);

  const currentLang = i18nCtx?.language || fallbackLang;
  const isNonLatin =
    currentLang === 'ar' ||
    currentLang === 'ta' ||
    currentLang === 'hi' ||
    currentLang === 'ml' ||
    currentLang === 'te' ||
    currentLang === 'kn';

  const shouldSkipTranslate =
    skipTranslate || (props as any).noTranslate || (props as any).translate === false;

  const translatedChildren = React.useMemo(() => {
    if (shouldSkipTranslate) {
      return children;
    }
    return translateChildren(children);
  }, [children, currentLang, shouldSkipTranslate]);

  return (
    <Component
      dir="ltr"
      className={cn(
        textVariants({ variant }),
        isNonLatin && 'tracking-normal',
        className,
        // A Button/FAB provides the semantic foreground for its surface. Keep
        // that contract last so a nested `text-foreground` cannot make text
        // disappear on a navy, orange, or destructive mobile action.
        textClass
      )}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      style={style}
      {...(props as any)}
    >
      {translatedChildren}
    </Component>
  );
}

export { Text, TextClassContext };
export default Text;
