import OmeggaPlugin, { OL, PS, PC, OmeggaPlayer } from 'omegga';

type Config = { slots: number; message: string; roles: string[] };

export default class Plugin implements OmeggaPlugin<Config, {}> {
  omegga: OL;
  config: PC<Config>;
  store: PS<{}>;

  cachedCount: number;

  constructor(omegga: OL, config: PC<Config>, store: PS<{}>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  isPriority = (user: OmeggaPlayer | string) => {
    const p = typeof user === 'string' ? this.omegga.getPlayer(user) : user;
    return (
      p.isHost() || p.getRoles().some((r) => this.config.roles.includes(r))
    );
  };

  errorMessage = (message: any) => {
    console.error('Priority slots error: ' + message);
    try {
      this.omegga.whisper('x', OMEGGA_UTIL.chat.red(message.toString()));
    } catch (_) {}
  };

  getPlayerCountDirectly = async (): Promise<[number, number]> => {
    const match = await Omegga.watchLogChunk(
      'Server.Status',
      /Players \((\d+)\/(\d+)\):$/,
      { first: (match) => match[0].startsWith('Players ('), timeoutDelay: 1000 }
    );

    const count = Number(match[0][1]);
    const max = Number(match[0][2]);
    this.cachedCount = max;
    return [count, max];
  };

  getPlayerCount = async (): Promise<[number, number]> => {
    try {
      return await this.getPlayerCountDirectly();
    } catch (e) {
      if (this.cachedCount)
        return [this.omegga.getPlayers().length, this.cachedCount];
      throw { message: 'no_cached_count', error: e };
    }
  };

  async init() {
    this.omegga.on('join', async ({ id }) => {
      setTimeout(async () => {
        try {
          const player = this.omegga.getPlayer(id);
          if (this.isPriority(player)) return;

          const [count, max] = await this.getPlayerCount();
          if (count > max - this.config.slots) {
            this.omegga.writeln(
              `Chat.Command /Kick "${player.name}" "${this.config.message
                .replace(/\{\}/g, this.config.slots.toString())
                .replace(/"/g, '\\"')}"`
            );
          }
        } catch (e) {
          this.errorMessage(e);
        }
      });
    });

    return {};
  }

  async stop() {}
}
