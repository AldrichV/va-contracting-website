type PhotoName =
  | "project-kitchen-hero"
  | "project-kitchen"
  | "project-washroom"
  | "project-interlock"
  | "project-deck"
  | "crew";

/** Intrinsic pixel sizes of the large and small variants in /public/images. */
const sizes: Record<PhotoName, { lg: [number, number]; sm: [number, number] }> = {
  "project-kitchen-hero": { lg: [1280, 777], sm: [800, 486] },
  "project-kitchen": { lg: [991, 743], sm: [800, 600] },
  "project-washroom": { lg: [1280, 743], sm: [800, 464] },
  "project-interlock": { lg: [1159, 738], sm: [800, 509] },
  "project-deck": { lg: [1280, 789], sm: [800, 493] },
  crew: { lg: [851, 719], sm: [800, 676] },
};

type PhotoProps = {
  alt: string;
  className?: string;
  name: PhotoName;
  /** The hero image loads eagerly; everything else waits until it is near the viewport. */
  priority?: boolean;
  /** CSS sizes hint, e.g. "(min-width: 900px) 50vw, 100vw". */
  sizesHint?: string;
};

export function Photo({ alt, className, name, priority = false, sizesHint = "100vw" }: PhotoProps) {
  const { lg, sm } = sizes[name];
  return (
    <picture className={className}>
      <source
        type="image/webp"
        srcSet={`/images/${name}-sm.webp ${sm[0]}w, /images/${name}-lg.webp ${lg[0]}w`}
        sizes={sizesHint}
      />
      <img
        alt={alt}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        height={lg[1]}
        loading={priority ? "eager" : "lazy"}
        src={`/images/${name}.jpg`}
        width={lg[0]}
      />
    </picture>
  );
}
