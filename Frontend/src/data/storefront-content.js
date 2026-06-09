export const categoryRouteMap = {
  "personal-audio": "/collection/personal-audio",
  "professional-audio": "/collection/professional-audio",
  "digital-camera": "/collection/digital-camera",
  "security-camera": "/collection/security-camera",
  "digital-photo-frames": "/collection/digital-photo-frames",
  "reading-light": "/collection/reading-light"
};

export const homeBanners = [];

export const blogEntries = [
  {
    slug: "best-digital-photo-frames-for-family-memories",
    image: "",
    category: "Digital Photo Frames",
    title: "Best Digital Photo Frames for Family Memories",
    body: "How to choose the right frame for gifting, shared albums, and long-term display quality.",
    intro:
      "Digital photo frames make it easier to keep family moments visible every day, but the right one depends on who it is for, where it will sit, and how often you want to refresh the content.",
    readTime: "4 min read",
    sections: [
      {
        heading: "Start with the display experience",
        paragraphs: [
          "Look at screen size, brightness, and viewing angles before anything else. A frame that looks great from the front but fades from the side can feel disappointing in a living room or hallway.",
          "For gifting, a screen that stays crisp in both daylight and warm indoor lighting usually creates the best first impression."
        ]
      },
      {
        heading: "Check how photos are shared",
        paragraphs: [
          "Some families want a frame that updates from a phone app, while others prefer simple storage card uploads. The best option is the one that matches how your family already shares photos.",
          "If grandparents will use the frame often, choose a setup that requires as few steps as possible after installation."
        ]
      },
      {
        heading: "Think about long-term placement",
        paragraphs: [
          "A bedroom, desk, or living room shelf all need slightly different frame sizes and styling. Slim bezels, stable stands, and a clean finish help the frame blend into daily life.",
          "Also check slideshow controls, orientation support, and whether the frame can loop albums smoothly without manual resets."
        ]
      }
    ]
  },
  {
    slug: "how-to-pick-personal-audio-gear-for-work-travel-and-fitness",
    image: "",
    category: "Personal Audio",
    title: "How to Pick Personal Audio Gear for Work, Travel, and Fitness",
    body: "A simple guide to matching listening style, battery life, and comfort to your routine.",
    intro:
      "The best personal audio gear is not just about loudness or bass. It should fit your routine, stay comfortable for long sessions, and match how you actually move through the day.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Match the gear to the setting",
        paragraphs: [
          "For work calls and long focus sessions, prioritize microphone clarity, balanced sound, and all-day comfort. For travel, lighter weight and stronger battery life usually matter more.",
          "For workouts, sweat resistance and a secure fit should come before premium materials or extra features."
        ]
      },
      {
        heading: "Comfort matters more than most specs",
        paragraphs: [
          "Ear tips, clamp force, and overall weight affect daily use more than many buyers expect. Even great sound becomes frustrating if the headset is uncomfortable after thirty minutes.",
          "Choose a style that fits your ears and habits first, then compare audio tuning and controls."
        ]
      },
      {
        heading: "Battery and controls should feel effortless",
        paragraphs: [
          "Quick pairing, easy touch or button controls, and dependable battery life reduce friction every day. A product that is easy to recharge and reconnect often feels better than one with a longer but less reliable battery claim.",
          "If you switch between laptop and phone frequently, simple device management is a major quality-of-life upgrade."
        ]
      }
    ]
  },
  {
    slug: "what-to-look-for-before-buying-a-compact-digital-camera",
    image: "",
    category: "Digital Camera",
    title: "What to Look for Before Buying a Compact Digital Camera",
    body: "Sensor basics, portability, use cases, and why trusted brands still matter for capture quality.",
    intro:
      "Compact digital cameras still offer a strong balance of portability and image quality, especially for buyers who want a dedicated shooting experience without carrying bulky gear.",
    readTime: "4 min read",
    sections: [
      {
        heading: "Understand the use case first",
        paragraphs: [
          "A travel camera, casual family camera, and content camera do not always need the same strengths. Some buyers need zoom range, while others care more about low-light performance or quick autofocus.",
          "Defining the main use case first helps you ignore features that sound impressive but will not matter in daily use."
        ]
      },
      {
        heading: "Portability should support the habit",
        paragraphs: [
          "A compact camera only helps if you are willing to carry it regularly. Weight, grip comfort, startup speed, and battery swapping all influence how often it gets used.",
          "Small differences in body design can decide whether a camera feels convenient or stays at home."
        ]
      },
      {
        heading: "Brand trust still has value",
        paragraphs: [
          "Reliable color science, service support, lens quality, and consistent performance still matter when comparing established camera makers. Trusted brands often deliver a smoother ownership experience over time.",
          "It is worth comparing image output, menu simplicity, and long-term support, not just headline megapixels."
        ]
      }
    ]
  }
];

export const blogEntriesBySlug = Object.fromEntries(blogEntries.map((entry) => [entry.slug, entry]));
