import { cloneElement, CSSProperties, ReactElement, useEffect, useState } from "react";

const WIDTH_RATIO = 0.9;
// Smaller than WIDTH_RATIO to leave room for the caption and actions at the bottom.
const HEIGHT_RATIO = 0.75;

interface FitToScreenImageProps {
    image: ReactElement;
    src: string;
}

function useViewportSize() {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    return size;
}

function FitToScreenImage({ image, src }: FitToScreenImageProps) {
    const viewport = useViewportSize();
    const [measured, setMeasured] = useState<{ src: string, width: number, height: number } | null>(null);
    const natural = measured?.src === src ? measured : null;

    useEffect(() => {
        const img = new Image();
        img.onload = () => setMeasured({ src, width: img.naturalWidth, height: img.naturalHeight });
        img.src = src;

        return () => {
            img.onload = null;
        };
    }, [src]);

    if (!natural) {
        return image;
    }

    const scale = Math.min(
        viewport.width * WIDTH_RATIO / natural.width,
        viewport.height * HEIGHT_RATIO / natural.height
    );

    const { style } = image.props as { style?: CSSProperties };

    return cloneElement(image as ReactElement<{ style?: CSSProperties }>, {
        style: {
            ...style,
            width: Math.round(natural.width * scale),
            height: Math.round(natural.height * scale),
            maxWidth: "none",
            maxHeight: "none",
        }
    });
}

export default FitToScreenImage;
