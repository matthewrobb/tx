export function registerConfigCommands(program, ctx) {
    const { config, respond } = ctx;
    // ─── config ────────────────────────────────────────────────────────────────
    program
        .command("config")
        .description("Show config")
        .argument("[section]", "config section")
        .argument("[subsection]", "config subsection")
        .action(() => {
        respond({ status: "ok", command: "config", config: config, display: JSON.stringify(config, null, 2) });
    });
}
//# sourceMappingURL=config.js.map