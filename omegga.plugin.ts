import OmeggaPlugin, { OL, PS, PC, OmeggaPlayer } from 'omegga';

type Config = { slots: number; message: string; roles: string[] };

export default class Plugin implements OmeggaPlugin<Config, {}> {
  omegga: OL;
  config: PC<Config>;
  store: PS<{}>;

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

  getPlayerCount = async (): Promise<[number, number]> => {
    const match = await Omegga.watchLogChunk(
      'Server.Status',
      /Players \((\d+)\/(\d+)\):$/,
      { first: (match) => match[0].startsWith('Players ('), timeoutDelay: 1000 }
    );

    return [Number(match[0][1]), Number(match[0][2])];
  };

  async init() {
    this.omegga.on('join', async ({ id }) => {
      setTimeout(async () => {
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
      });
    });

    return {};
  }

  async stop() {}
}
