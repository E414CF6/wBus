import {describe, expect, it} from "vitest";
import React from "react";
import {Modal} from "./Modal";

describe("Modal component exports", () => {
    it("is exported as a function/component", () => {
        expect(typeof Modal).toBe("function");
    });

    it("creates a React element without errors with modalId and queryKey", () => {
        const element = React.createElement(Modal, {
            isOpen: false,
            onClose: () => {},
            title: "Test Modal",
            modalId: "city",
            queryKey: "modal",
            enableHistory: true,
        });
        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.modalId).toBe("city");
        expect(element.props.queryKey).toBe("modal");
    });
});
