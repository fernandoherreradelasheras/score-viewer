import { useMemo, useState } from "react";
import { Popover, Typography } from "antd";
import { useTranslation } from "react-i18next";
import useStore from "../store";

const { Text } = Typography;

const THUMBNAIL_WIDTH = 200;

interface PagePreviewProps {
    page: number;
    children: React.ReactNode;
}

function PagePreview({ page, children }: PagePreviewProps) {
    const { t } = useTranslation("common");
    const score = useStore.use.score();
    const sectionPageMap = useStore.use.sectionPageMap();
    const getCachedPage = useStore.use.getCachedPage();

    const [open, setOpen] = useState(false);
    const [thumbnail, setThumbnail] = useState<{ svgHTML: string, aspect: number } | null>(null);

    // The section a page belongs to is the last one that starts at or before it.
    const sectionLabel = useMemo(() => {
        const starts = (score?.properties.sections ?? [])
            .map(section => ({ label: section.label, page: sectionPageMap[section.id] }))
            .filter(section => section.label && section.page > 0);
        return starts.reduce<string | null>(
            (found, section) => section.page <= page ? section.label : found, null);
    }, [score?.properties.sections, sectionPageMap, page]);

    // Read on opening rather than subscribed to: the cache changes with every page the
    // idle pre-render adds, and none of that has to redraw the paginator.
    const onOpenChange = (opening: boolean) => {
        const cached = opening ? getCachedPage(page) : null;
        setThumbnail(cached?.svgHTML && cached.width && cached.height
            ? { svgHTML: cached.svgHTML, aspect: cached.height / cached.width }
            : null);
        setOpen(opening && (sectionLabel != null || cached?.svgHTML != null));
    };

    const content = (
        <div style={{ maxWidth: THUMBNAIL_WIDTH }}>
            <Text strong>{t('score.pageNumber', { number: page })}</Text>
            {sectionLabel && <Text type="secondary">{` · ${sectionLabel}`}</Text>}
            {thumbnail && (
                <div
                    className="page-thumbnail"
                    style={{
                        width: THUMBNAIL_WIDTH,
                        height: Math.round(THUMBNAIL_WIDTH * thumbnail.aspect),
                        marginTop: 8,
                    }}
                    dangerouslySetInnerHTML={{ __html: thumbnail.svgHTML }} />
            )}
        </div>
    );

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            mouseEnterDelay={0.4}
            content={content}
        >
            {children}
        </Popover>
    );
}

export default PagePreview;
