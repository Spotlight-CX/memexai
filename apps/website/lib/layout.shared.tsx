import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';
import { BrandMark } from '@/components/brand-mark';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <BrandMark size="nav" />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    themeSwitch: { enabled: false },
  };
}
