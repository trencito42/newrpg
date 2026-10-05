import type { CommunitySliderCard } from "@/components/home/HomeCommunitySlider";

const BASE_CARDS: CommunitySliderCard[] = [
  {
    id: "bug",
    href: "/support/tickets?type=bug",
    titleKey: "home.community_slider.cards.bug.title",
    descriptionKey: "home.community_slider.cards.bug.description",
    ctaKey: "home.community_slider.cards.bug.cta",
    icon: "bug",
    iconClassName: "text-red-400/90",
  },
  {
    id: "forum",
    href: "/forum",
    titleKey: "home.community_slider.cards.forum.title",
    descriptionKey: "home.community_slider.cards.forum.description",
    ctaKey: "home.community_slider.cards.forum.cta",
    hintKey: "home.community_slider.cards.forum.hint",
    icon: "forum",
    iconClassName: "text-[#D7B558]",
  },
  {
    id: "feed",
    href: "/feed",
    titleKey: "home.community_slider.cards.feed.title",
    descriptionKey: "home.community_slider.cards.feed.description",
    ctaKey: "home.community_slider.cards.feed.cta",
    hintKey: "home.community_slider.cards.feed.hint",
    icon: "feed",
    iconClassName: "text-violet-300/80",
  },
  {
    id: "updates",
    href: "/updates",
    titleKey: "home.community_slider.cards.updates.title",
    descriptionKey: "home.community_slider.cards.updates.description",
    ctaKey: "home.community_slider.cards.updates.cta",
    hintKey: "home.community_slider.cards.updates.hint",
    icon: "updates",
    iconClassName: "text-[#D7B558]/90",
  },
  {
    id: "support",
    href: "/support/tickets",
    titleKey: "home.community_slider.cards.support.title",
    descriptionKey: "home.community_slider.cards.support.description",
    ctaKey: "home.community_slider.cards.support.cta",
    icon: "support",
    iconClassName: "text-sky-400/85",
  },
];

export function buildHomeCommunitySliderCards(username: string | null): CommunitySliderCard[] {
  const cards = [...BASE_CARDS];
  if (username) {
    cards.push(
      {
        id: "activity",
        href: "/forum/my",
        titleKey: "home.community_slider.cards.activity.title",
        descriptionKey: "home.community_slider.cards.activity.description",
        ctaKey: "home.community_slider.cards.activity.cta",
        icon: "activity",
        iconClassName: "text-[#D7B558]",
      },
      {
        id: "profile",
        href: `/players/${encodeURIComponent(username)}`,
        titleKey: "home.community_slider.cards.profile.title",
        descriptionKey: "home.community_slider.cards.profile.description",
        ctaKey: "home.community_slider.cards.profile.cta",
        icon: "profile",
        iconClassName: "text-[#F2EFE8]/80",
      }
    );
  }
  return cards;
}
