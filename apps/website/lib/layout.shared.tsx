import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';
import { BrandMark } from '@/components/brand-mark';
import { MessageSquare, Calendar } from 'lucide-react';
import { slackUrl, getFounderCallUrl } from './links';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <BrandMark size="nav" href={null} />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    themeSwitch: { enabled: false },
    links: [
      {
        type: 'icon',
        text: 'Community Slack',
        label: 'Community Slack',
        icon: <MessageSquare size={16} />,
        url: slackUrl,
        external: true,
      },
      {
        type: 'button',
        text: 'Talk to us',
        icon: <Calendar size={16} />,
        url: getFounderCallUrl(),
        external: true,
        secondary: true,
      },
    ],
  };
}
