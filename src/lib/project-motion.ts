export const projectLayoutTransition = { duration: 0.28, ease: "easeInOut" as const };

export const projectLayoutId = (id: string, part = "card") => `portfolio-project-${id}-${part}`;
