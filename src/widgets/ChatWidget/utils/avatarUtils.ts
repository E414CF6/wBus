export function getAvatarGradient(name: string, tag = ""): string {
    const gradients = [
        "from-blue-500 to-indigo-600",
        "from-emerald-500 to-teal-600",
        "from-purple-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-rose-500 to-red-600",
        "from-cyan-500 to-blue-600",
        "from-violet-500 to-purple-700",
        "from-teal-500 to-emerald-600",
    ];
    const cleanTag = tag ? tag.replace(/^#+/, "").trim() : "";
    const combined = `${name}${cleanTag}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
}
