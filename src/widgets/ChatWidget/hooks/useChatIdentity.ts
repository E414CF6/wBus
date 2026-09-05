import {useState} from "react";

import {generateUserTag, getRandomNickname} from "@data/nicknames";

export function useChatIdentity() {
    const [authorName, setAuthorName] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const savedNick = localStorage.getItem("wbus_chat_nickname");
                if (savedNick && savedNick.trim() && savedNick.trim() !== "익명") {
                    return savedNick.trim();
                }
                const fresh = getRandomNickname();
                localStorage.setItem("wbus_chat_nickname", fresh);
                return fresh;
            } catch {
                // Storage error
            }
        }
        return getRandomNickname();
    });

    const [userTag, setUserTag] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const savedTag = localStorage.getItem("wbus_user_tag");
                if (savedTag && savedTag.trim()) {
                    return savedTag.replace(/^#+/, "").trim();
                }
                const fresh = generateUserTag();
                localStorage.setItem("wbus_user_tag", fresh);
                return fresh;
            } catch {
                // Storage error
            }
        }
        return generateUserTag();
    });

    // Re-roll random nickname
    const handleRerollNickname = (onSuccess?: (msg: string) => void) => {
        const next = getRandomNickname(authorName);
        setAuthorName(next);
        try {
            localStorage.setItem("wbus_chat_nickname", next);
            if (onSuccess) {
                onSuccess(`닉네임이 '${next}'(으)로 변경되었습니다`);
            }
        } catch {
            // Ignore
        }
    };

    return {
        authorName, userTag, setAuthorName, setUserTag, handleRerollNickname,
    };
}
