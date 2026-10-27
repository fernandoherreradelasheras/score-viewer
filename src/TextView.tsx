import { cloneElement, CSSProperties, useCallback } from 'react'
import { Components } from "react-markdown";
import { FetchError, LyricItem, PlayingState } from './types';
import ErrorView from './ErrorView';
import { useTranslation } from 'react-i18next';
import { Button, Image, ImageProps } from 'antd';
import useStore from './store';
import { CloseOutlined } from '@ant-design/icons';
import FitToScreenImage from './components/FitToScreenImage';
import { IntroContent, PoemItemsContent } from './TextContent';

const imagePreview: ImageProps['preview'] = {
    actionsRender: (actions, { icons, image }) => <>
        {image.alt ? <div className="text-image-preview-caption">{image.alt}</div> : null}
        {cloneElement(actions, undefined, icons.zoomOutIcon, icons.zoomInIcon)}
    </>,
    imageRender: (image, { image: { url } }) => <FitToScreenImage image={image} src={url} />
}

const markdownComponents: Components = {
    img: ({ src, alt, title, className, style }) =>
        <Image src={src} alt={alt} title={title} rootClassName={className} style={style} preview={imagePreview} />
}

const textStyle: CSSProperties = { textAlign: "left", flex: 1, minWidth: 0, maxWidth: "1000px" }

export interface TextViewProps {
    title?: string;
    intro?: string | FetchError | null;
    // URL the introduction was fetched from, to resolve its "./" image paths.
    introUrl?: string | null;
    items?: LyricItem[] | null;
    comments?: string | null;
}

function TextView(props: TextViewProps) {
    const { t } = useTranslation("common");
    const splitView = useStore.use.isSplitView();
    const setSplitView = useStore.use.setIsSplitView();
    const playingState = useStore.use.playingState();
    const { title, intro, introUrl, items, comments } = props

    const close = useCallback(() => {
        setSplitView(false);
    }, [setSplitView]);

    const introError = intro instanceof FetchError ? intro : null
    const errorView = introError ?
        <ErrorView message={t('error.fetchErrorDescription')} description={
            <div>
                <ul>
                    <li key="intro">
                        <strong>{t('error.fetchIntroError')}:</strong> {introError.message}
                    </li>
                </ul>
            </div>
        } /> : null

    return (
        <div>
            {splitView ?
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button icon={<CloseOutlined />} onClick={() => close()}
                        disabled={playingState === PlayingState.PLAYING} />
                </div>
                : null}

            {errorView ? errorView : null}
            <div style={{ display: "flex", flexDirection: "row" }}>

                {intro ?
                    <IntroContent title={title} style={textStyle} components={markdownComponents}
                        markdown={intro instanceof FetchError ? `**${t("error.fetchTextSeeErrorAbove")}**` : intro}
                        documentUrl={introUrl} />
                    : items && items.length > 0 ?
                        <PoemItemsContent title={title} style={textStyle} components={markdownComponents}
                            items={items} comments={comments} />
                        : null}
            </div>
        </div>
    )
}

export default TextView
