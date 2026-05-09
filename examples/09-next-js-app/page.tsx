// app/courses/[slug]/page.tsx
//
// Next.js 13+ App Router page using the PlayerStack wrapper.
// dynamic() with ssr: false skips SSR for the player component entirely
// and prevents any custom-element vs hydration mismatch warnings.

import dynamic from "next/dynamic";

const PlayerStack = dynamic(() => import("./PlayerStack").then((m) => m.PlayerStack), {
  ssr: false,
  loading: () => <div className="player-skeleton" />,
});

interface PageProps {
  params: { slug: string };
}

export default function CoursePage({ params }: PageProps) {
  // In a real app you'd fetch the course config from your DB / Sellf
  const course = {
    title: "Lesson 1: Introduction",
    videoUrl: `https://example.com/courses/${params.slug}/lesson-1.mp4`,
    poster: `https://example.com/courses/${params.slug}/poster.webp`,
    productUrl: `https://example.com/buy/${params.slug}`,
  };

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px" }}>
      <h1>{course.title}</h1>

      <PlayerStack
        src={course.videoUrl}
        poster={course.poster}
        title={course.title}
        config={{
          brandedThumb: { enabled: true, clickToLoad: true },
          controls: { accent: "#008aff" },
          ctaEnd: {
            enabled: true,
            title: "Loved it? Get the full course.",
            button: {
              label: "Enroll now",
              url: course.productUrl,
              utm: `utm_source=lesson&utm_campaign=${params.slug}`,
            },
            showReplay: true,
          },
        }}
        style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16 / 9" }}
      />
    </main>
  );
}
