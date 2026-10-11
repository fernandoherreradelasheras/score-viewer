import { ComponentProps, useMemo } from "react";
import { Button, Dropdown } from "antd";
import Icon, { CheckOutlined, DownOutlined, LoadingOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import useStore from "./store";

const MAX_LABEL_CHARS = 20;

const CassetteSvg = () => (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1" y="2.5" width="14" height="11" rx="1.2" />
        <rect x="3.5" y="4.8" width="9" height="4.4" rx="2.2" />
        <circle cx="5.7" cy="7" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="10.3" cy="7" r="0.9" fill="currentColor" stroke="none" />
        <path d="M4.5 13.5l1-2.2h5l1 2.2" />
    </svg>
);

const PianoKeysSvg = () => (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
        <path d="M5.8 13.5V9M10.2 13.5V9" />
        <rect x="4.6" y="2.5" width="2.4" height="6.5" fill="currentColor" stroke="none" />
        <rect x="9" y="2.5" width="2.4" height="6.5" fill="currentColor" stroke="none" />
    </svg>
);

type IconProps = Omit<ComponentProps<typeof Icon>, 'component'>;
const CassetteOutlined = (props: IconProps) => <Icon component={CassetteSvg} {...props} />;
const PianoKeysOutlined = (props: IconProps) => <Icon component={PianoKeysSvg} {...props} />;

// The audio version belongs to the loaded score, not to the viewer settings that
// persist across scores, so it lives with the transport rather than in the options
// panel. Only worth showing when there is actually something to choose from.
function AudioVersionMenu() {
    const { t } = useTranslation("common");
    const score = useStore.use.score();
    const selectedAudioIndex = useStore.use.selectedAudioIndex();
    const setSelectedAudioIndex = useStore.use.setSelectedAudioIndex();
    const canPlay = useStore.use.canPlay();

    const versions = useMemo(() =>
        (score?.audioFiles ?? []).map((audio, index) => ({
            index,
            label: audio.name ?? (audio.source.kind === 'file'
                ? audio.source.url.split('/').pop() ?? audio.source.url
                : 'MIDI'),
            isMidi: audio.source.kind === 'midi',
        })), [score]);

    const selected = versions[selectedAudioIndex];
    if (versions.length < 2 || !selected) return null;

    const icon = (isMidi: boolean) => isMidi ? <PianoKeysOutlined /> : <CassetteOutlined />;

    return (
        <Dropdown
            trigger={['click']}
            placement="topRight"
            menu={{
                selectable: true,
                selectedKeys: [String(selectedAudioIndex)],
                onClick: ({ key }) => setSelectedAudioIndex(Number(key)),
                items: [{
                    type: 'group',
                    label: t('audioVersion.title'),
                    children: versions.map((version) => ({
                        key: String(version.index),
                        icon: icon(version.isMidi),
                        label: (
                            <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "space-between" }}>
                                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                                    <span>{version.label}</span>
                                    <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
                                        {version.isMidi ? t('audioVersion.synthesized') : t('audioVersion.recording')}
                                    </span>
                                </div>
                                {version.index === selectedAudioIndex ? <CheckOutlined style={{ color: "#1677ff" }} /> : null}
                            </div>
                        ),
                    })),
                }],
            }}>
            <Button
                data-testid="audio-version-menu"
                shape="round"
                title={selected.label}
                style={{ height: 38, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                icon={canPlay ? icon(selected.isMidi) : <LoadingOutlined />}>
                <span style={{
                    display: "inline-block", maxWidth: `${MAX_LABEL_CHARS}ch`,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                    {selected.label}
                </span>
                <DownOutlined style={{ fontSize: 10 }} />
            </Button>
        </Dropdown>
    );
}

export default AudioVersionMenu;
