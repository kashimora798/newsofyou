import React from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  type?: "image" | "video";
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, type = "image", onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <X className="h-6 w-6" />
      </button>
      {type === "video" ? (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="max-w-[95vw] max-h-[90vh] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={src}
          alt="Full size"
          className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};

export default ImageLightbox;
