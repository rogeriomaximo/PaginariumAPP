import { Platform } from "react-native";

// Lembretes locais (agendados no próprio aparelho).
// Funcionam no Android/iOS. Na web, ou se o módulo nativo não estiver
// incluído no build, as funções simplesmente não fazem nada (o app não cai).

export interface AluguelAtivo {
  livro_id: number;
  nome?: string;
  data_fim?: string; // "YYYY-MM-DD" (ou ISO; só os 10 primeiros caracteres importam)
}

type ModuloNotificacoes = typeof import("expo-notifications");

const CANAL = "paginarium";
const ehNativo = Platform.OS !== "web";

// Horários dos lembretes
const HORA_DEVOLUCAO = 9; // 09:00
const HORA_LEITURA = 20; // 20:00 todos os dias

// Carrega o módulo nativo dentro de try/catch: se o build não tiver
// o expo-notifications, o app abre normalmente, só sem lembretes.
let Notifications: ModuloNotificacoes | null = null;

if (ehNativo) {
  try {
    Notifications = require("expo-notifications") as ModuloNotificacoes;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (erro) {
    console.log("expo-notifications indisponível neste build:", erro);
    Notifications = null;
  }
}

function parseData(dataFim: string): Date {
  const [ano, mes, dia] = String(dataFim).substring(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, "0");
  const m = String(data.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${data.getFullYear()}`;
}

function comHora(data: Date, hora: number): Date {
  const nova = new Date(data);
  nova.setHours(hora, 0, 0, 0);
  return nova;
}

export async function prepararNotificacoes(): Promise<boolean> {
  const N = Notifications;
  if (!N) return false;

  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync(CANAL, {
        name: "Paginarium",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const atual = await N.getPermissionsAsync();
    let status = atual.status;

    if (status !== "granted" && atual.canAskAgain) {
      status = (await N.requestPermissionsAsync()).status;
    }

    return status === "granted";
  } catch (erro) {
    console.log("Erro ao preparar notificações:", erro);
    return false;
  }
}

export async function cancelarLembretes() {
  const N = Notifications;
  if (!N) return;

  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch (erro) {
    console.log("Erro ao cancelar lembretes:", erro);
  }
}

async function agendar(N: ModuloNotificacoes, titulo: string, corpo: string, quando: Date) {
  await N.scheduleNotificationAsync({
    content: { title: titulo, body: corpo, sound: true },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: quando,
      channelId: CANAL,
    },
  });
}

// Reagenda TODOS os lembretes com base nos aluguéis ativos.
// Chame sempre que a lista de aluguéis for carregada.
export async function sincronizarLembretes(alugueis: AluguelAtivo[]) {
  const N = Notifications;
  if (!N) return;

  try {
    const permitido = await prepararNotificacoes();
    if (!permitido) return;

    await N.cancelAllScheduledNotificationsAsync();

    const agora = new Date();
    const ativos = alugueis.filter((a) => a.data_fim);

    if (ativos.length === 0) return;

    // 1) DEVOLUÇÃO: 1 dia antes e no último dia, às 09:00
    for (const aluguel of ativos) {
      const fim = parseData(aluguel.data_fim as string);
      const nome = aluguel.nome ?? "seu livro";

      const vespera = comHora(
        new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 1),
        HORA_DEVOLUCAO
      );
      const ultimoDia = comHora(fim, HORA_DEVOLUCAO);

      if (vespera > agora) {
        await agendar(
          N,
          "⏰ Devolução amanhã",
          `O aluguel de "${nome}" termina amanhã (${formatarData(fim)}).`,
          vespera
        );
      }

      if (ultimoDia > agora) {
        await agendar(
          N,
          "📕 Último dia de aluguel",
          `Hoje é o último dia para ler "${nome}". Aproveite!`,
          ultimoDia
        );
      }
    }

    // 2) LEITURA: lembrete diário às 20:00 enquanto houver livro alugado
    const corpoLeitura =
      ativos.length === 1
        ? `Que tal continuar lendo "${ativos[0].nome ?? "seu livro"}" hoje?`
        : `Você tem ${ativos.length} livros alugados esperando por você.`;

    await N.scheduleNotificationAsync({
      content: {
        title: "📖 Hora de ler",
        body: corpoLeitura,
        sound: true,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: HORA_LEITURA,
        minute: 0,
        channelId: CANAL,
      },
    });
  } catch (erro) {
    console.log("Erro ao sincronizar lembretes:", erro);
  }
}

// 3) ALUGUEL: aviso imediato quando o aluguel é confirmado
export async function notificarAluguelConfirmado(
  nomeLivro: string,
  dataFim?: string
) {
  const N = Notifications;
  if (!N) return;

  try {
    const permitido = await prepararNotificacoes();
    if (!permitido) return;

    const ate = dataFim ? ` até ${formatarData(parseData(dataFim))}` : "";

    await N.scheduleNotificationAsync({
      content: {
        title: "✅ Aluguel confirmado",
        body: `"${nomeLivro}" está disponível para leitura${ate}.`,
        sound: true,
      },
      trigger: null,
    });
  } catch (erro) {
    console.log("Erro ao notificar aluguel:", erro);
  }
}