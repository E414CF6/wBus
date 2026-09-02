import {useEffect, useState} from "react";
import {generateUserTag, getRandomNickname} from "@/data/nicknames";

export function useChatIdentity() {
    const [authorName, setAuthorName] = useState("");
    const [userTag, setUserTag] = useState("");

    // Initialize user nickname and tag
    useEffect(() => {
        try {
            let savedNick = localStorage.getItem("wbus_chat_nickname");
            if (!savedNick || !savedNick.trim() || savedNick.trim() === "익명") {
                savedNick = getRandomNickname();
                localStorage.setItem("wbus_chat_nickname", savedNick);
            }
            setAuthorName(savedNick);

            let savedTag = localStorage.getItem("wbus_user_tag");
            if (!savedTag || !savedTag.startsWith("#")) {
                savedTag = generateUserTag();
                localStorage.setItem("wbus_user_tag", savedTag);
            }
            setUserTag(savedTag);
        } catch {
            setAuthorName(getRandomNickname());
            setUserTag(generateUserTag());
        }
    }, []);

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
        authorName,
        userTag,
        setAuthorName,
        setUserTag,
        handleRerollNickname,
    };
}
