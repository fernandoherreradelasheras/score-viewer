import { useEffect, useState } from "react";
import { Popover, Typography } from "antd";
import { useTranslation } from "react-i18next";
import usePreviewPopover from "../hooks/usePreviewPopover";

const { Text } = Typography;

const THUMBNAIL_WIDTH = 200;

// Aspect ratio of the empty popup until the image is loaded.
const DEFAULT_ASPECT = 1.4;
// Measured aspect ratios of images, keyed by their source URL to avoid re-measuring
const aspectRatios = new Map<string, number>();

interface FacsimilePreviewProps {
    page: number;
    current: boolean;
    name: string;
    src: string;
    children: React.ReactElement;
}

function FacsimilePreview({ page, current, name, src, children }: FacsimilePreviewProps) {
    const { t } = useTranslation("common");

    // The current page needs no preview, it is already on screen.
    const { open, bindTrigger } = usePreviewPopover(() => !current);
    const [measured, setMeasured] = useState<{ src: string, aspect: number } | null>(null);

    const aspect = measured?.src === src ? measured.aspect : aspectRatios.get(src) ?? null;

    useEffect(() => {
        if (!open || aspect != null) {
            return;
        }
        const image = new Image();
        image.onload = () => {
            const ratio = image.naturalHeight / image.naturalWidth;
            aspectRatios.set(src, ratio);
            setMeasured({ src, aspect: ratio });
        };
        image.src = src;

        return () => {
            image.onload = null;
        };
    }, [open, aspect, src]);

    const content = (
        <div style={{ maxWidth: THUMBNAIL_WIDTH }}>
            <Text strong>{t('score.pageNumber', { number: page })}</Text>
            {name && <Text type="secondary">{` · ${name}`}</Text>}
            <div style={{
                width: THUMBNAIL_WIDTH,
                height: Math.round(THUMBNAIL_WIDTH * (aspect ?? DEFAULT_ASPECT)),
                marginTop: 8,
                background: "rgba(0, 0, 0, 0.04)",
            }}>
                {aspect != null && (
                    <img
                        src={src}
                        alt={name}
                        style={{ display: "block", width: "100%", height: "100%" }} />
                )}
            </div>
        </div>
    );

    return (
        <Popover
            open={open}
            trigger={[]}
            placement="bottom"
            content={content}
        >
            {bindTrigger(children)}
        </Popover>
    );
}

export default FacsimilePreview;
