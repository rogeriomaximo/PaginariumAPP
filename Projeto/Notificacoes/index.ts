import { Platform } from "react-native";

// Carregado só no celular: na web o módulo emite avisos e não agenda nada.
const Notifications: typeof import("expo-notifications") =
  Platform.OS !== "web" ? require("expo-notifications") : (null as any);

// Lembretes locais (agendados no próprio aparelho).
// Funcionam no Android/iOS. Na web, as funções não fazem nada.

export interface AluguelAtivo {
  livro_id: number;
  nome?: string;
  data_fim?: string; // "YYYY-MM-DD" (ou ISO; só os 10 primeiros caracteres importam)
}

const CANAL = "paginarium";
const ehNativo = Platform.OS !== "web";

// Horários dos lembretes
const HORA_DEVOLUCAO = 9; // 09:00
const HORA_LEITURA = 20; // 20:00 todos os dias

if (ehNativo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
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
  if (!ehNativo) return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: "Paginarium",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let status = atual.status;

    if (status !== "granted" && atual.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }

    return status === "granted";
  } catch (erro) {
    console.log("Erro ao preparar notificações:", erro);
    return false;
  }
}

export async function cancelarLembretes() {
  if (!ehNativo) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (erro) {
    console.log("Erro ao cancelar lembretes:", erro);
  }
}

async function agendar(titulo: string, corpo: string, quando: Date) {
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: corpo, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: quando,
      channelId: CANAL,
    },
  });
}

// Reagenda TODOS os lembretes com base nos aluguéis ativos.
// Chame sempre que a lista de aluguéis for carregada.
export async function sincronizarLembretes(alugueis: AluguelAtivo[]) {
  if (!ehNativo) return;

  try {
    const permitido = await prepararNotificacoes();
    if (!permitido) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

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
          "⏰ Devolução amanhã",
          `O aluguel de "${nome}" termina amanhã (${formatarData(fim)}).`,
          vespera
        );
      }

      if (ultimoDia > agora) {
        await agendar(
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

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📖 Hora de ler",
        body: corpoLeitura,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
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
  if (!ehNativo) return;

  try {
    const permitido = await prepararNotificacoes();
    if (!permitido) return;

    const ate = dataFim ? ` até ${formatarData(parseData(dataFim))}` : "";

    await Notifications.scheduleNotificationAsync({
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