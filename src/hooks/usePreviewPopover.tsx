import { cloneElement, useCallback, useEffect, useRef, useState } from "react";

// Time the pointer has to rest over a page button before its preview shows.
const PREVIEW_DELAY_MS = 1000;

type TriggerProps = {
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onClick?: React.MouseEventHandler;
};

/**
 * Open state for a paginator page preview. The popover is controlled by hand
 * instead of by its hover trigger, so that a click on the button can hide the
 * preview or, when it is not showing yet, restart the wait.
 *
 * @param canOpen Called when the delay expires; returning false keeps it closed.
 */
function usePreviewPopover(canOpen: () => boolean = () => true) {
    const [open, setOpen] = useState(false);
    const timer = useRef<number | null>(null);
    const canOpenRef = useRef(canOpen);
    useEffect(() => {
        canOpenRef.current = canOpen;
    });

    const clearTimer = useCallback(() => {
        if (timer.current != null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();
        timer.current = window.setTimeout(() => {
            timer.current = null;
            setOpen(canOpenRef.current());
        }, PREVIEW_DELAY_MS);
    }, [clearTimer]);

    useEffect(() => clearTimer, [clearTimer]);

    // Adds the handlers to the page button, keeping any it already has.
    const bindTrigger = (child: React.ReactElement) => {
        const props = child.props as TriggerProps;
        return cloneElement(child as React.ReactElement<TriggerProps>, {
            onMouseEnter: event => {
                props.onMouseEnter?.(event);
                startTimer();
            },
            onMouseLeave: event => {
                props.onMouseLeave?.(event);
                clearTimer();
                setOpen(false);
            },
            onClick: event => {
                props.onClick?.(event);
                if (open) {
                    setOpen(false);
                } else {
                    startTimer();
                }
            },
        });
    };

    return { open, bindTrigger };
}

export default usePreviewPopover;
