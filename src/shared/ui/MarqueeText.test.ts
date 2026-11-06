import {describe, expect, it} from "vitest";
import React from "react";
import {MarqueeText, PopupMarquee} from "./MarqueeText";

describe("MarqueeText component", () => {
    it("is exported as a function/component", () => {
        expect(typeof MarqueeText).toBe("function");
        expect(typeof PopupMarquee).toBe("function");
    });

    it("creates a React element with default and custom props", () => {
        const element = React.createElement(MarqueeText, {
            text: "장양리 - 연세대미래캠퍼스",
            durationSeconds: 14,
            fadeEdges: true,
            className: "font-black text-xs",
            containerClassName: "min-w-0 flex-1",
        });

        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.text).toBe("장양리 - 연세대미래캠퍼스");
        expect(element.props.durationSeconds).toBe(14);
        expect(element.props.fadeEdges).toBe(true);
        expect(element.props.className).toBe("font-black text-xs");
    });

    it("creates PopupMarquee element with backward compatibility props", () => {
        const element = React.createElement(PopupMarquee, {
            text: "30",
            maxWidthClass: "max-w-7",
        });

        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.text).toBe("30");
        expect(element.props.maxWidthClass).toBe("max-w-7");
    });
});
