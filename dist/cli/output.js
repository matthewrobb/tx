export function formatAgent(response) {
    return JSON.stringify(response, null, 2);
}
export function formatHuman(response) {
    if (response.status === "error") {
        return `Error: ${response.error ?? "Unknown error"}`;
    }
    if (response.status === "paused" && response.action?.type === "confirm") {
        return `${response.action.message}\n\nRun: ${response.action.next_command}`;
    }
    if (response.display) {
        return response.display;
    }
    return `[${response.command}] ${response.status}`;
}
export function output(response, agent) {
    const formatted = agent ? formatAgent(response) : formatHuman(response);
    process.stdout.write(formatted + "\n");
}
//# sourceMappingURL=output.js.map