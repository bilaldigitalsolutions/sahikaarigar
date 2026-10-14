// =============================================================================
// /skills/[skill] — SEO landing page for one skill (e.g. /skills/electrician)
// =============================================================================
// Server component so it can export `generateStaticParams` (required by
// `output: "export"`) and `generateMetadata`. The actual listing is rendered by
// the client component `SkillLanding`, which pulls live data from the
// auth-server at runtime (a static export has no server to fetch at build time).
// =============================================================================

import type { Metadata } from 'next';
import { SKILLS } from '@/constants';
import { generateSlug } from '@/utils';
import SkillLanding from './SkillLanding';

/** Pre-render one static page per skill so the route exists in the export. */
export function generateStaticParams() {
  return SKILLS.map((skill) => ({ skill: generateSlug(skill.id) }));
}

function findSkill(slug: string) {
  return SKILLS.find((skill) => generateSlug(skill.id) === slug) ?? null;
}

export function generateMetadata({ params }: { params: { skill: string } }): Metadata {
  const skill = findSkill(params.skill);
  const label = skill?.label ?? 'Worker';
  const icon = skill?.icon ? `${skill.icon} ` : '';

  return {
    title: `${label} in Hyderabad`,
    description: `Hyderabad me verified ${label.toLowerCase()}s dhundho. Real ratings, reviews aur direct hire - SahiKaarigar.`,
    alternates: { canonical: `/skills/${params.skill}` },
    openGraph: {
      title: `${icon}${label} in Hyderabad | SahiKaarigar`,
      description: `Verified ${label.toLowerCase()}s in Hyderabad - ratings, reviews aur direct hire.`,
      url: `/skills/${params.skill}`,
    },
  };
}

export default function SkillPage({ params }: { params: { skill: string } }) {
  return <SkillLanding slug={params.skill} />;
}
