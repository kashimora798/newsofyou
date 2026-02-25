import React from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ title, description, image, url }) => {
  if (!title && !description) return null;

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden border border-border/50 hover:border-border transition-colors mt-1.5 mb-1"
    >
      {image && (
        <img src={image} alt="" className="w-full h-32 object-cover" loading="lazy" />
      )}
      <div className="p-2.5">
        {title && (
          <p className="text-xs font-semibold line-clamp-2 flex items-center gap-1">
            {title}
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </p>
        )}
        {description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
        )}
      </div>
    </a>
  );
};

export default LinkPreview;
