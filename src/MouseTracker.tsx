import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_TIMEOUT = 1000;

interface MouseTrackerProps {
    track: HTMLDivElement;
    getContent: (event: MouseEvent) => string | undefined;
}

const MouseTracker = ({ track, getContent }: MouseTrackerProps) => {
    const element = useRef<HTMLDivElement|null>(null);
    const timeoutId = useRef(-1);
    const [content, setContent] = useState<string | undefined>(undefined);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (!element.current) {
                return
            }
            element.current.style.visibility = 'hidden';
            if (timeoutId.current != -1) {
                window.clearTimeout(timeoutId.current);
                timeoutId.current = -1;
            }

            if (element.current && top?.innerHeight) {
                const x = e.clientX - element.current.clientWidth / 2;
                const y = e.clientY - top.innerHeight - element.current.clientHeight / 2 - 8;
                element.current.style.transform = `translate(${x}px, ${y}px)`;

                const newContent = getContent(e);
                if (!newContent || newContent != content) {
                    setContent(newContent)
                }
                if (newContent) {
                    timeoutId.current = window.setTimeout(() => {
                        if (element.current) {
                            element.current.style.visibility = 'visible';
                        }
                    }, SHOW_TIMEOUT)
                }
            }

        }
        track.addEventListener('mousemove', handler);
        return () => track.removeEventListener('mousemove', handler);
    }, [track, getContent, content]);

    return createPortal(
            <div className='mouse-tracker' ref={element}>
                {content}
            </div>,
        document.body);
};

export default MouseTracker;