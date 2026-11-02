import { Platform } from "react-native";

/**
 * Notificações locais (não precisam de servidor de push).
 * Só funcionam no Android.
 *
 * IMPORTANTE: o expo-notifications é carregado só na hora de usar,
 * dentro de try/catch. Se a biblioteca não existir no app instalado
 * (build antigo, Expo Go, web), nada quebra: os lembretes apenas
 * não são agendados.
 *
 * Três tipos de aviso:
 *  - Aluguel:   confirmação imediata + aviso 3 dias antes do fim
 *  - Leitura:   lembrete às 19h nos próximos dias (até o fim do aluguel)
 *  - Devolução: aviso 1 dia antes e no dia do vencimento, às 9h
 */

const CANAL = "alugueis";

const DIAS_LEMBRETE_LEITURA = 7;
const HORA_LEITURA = 19;
const HORA_DEVOLUCAO = 9;

// ---------------------------------------------------------------
// Carregamento seguro da biblioteca
// ---------------------------------------------------------------

let modulo: any = null;
let tentouCarregar = false;

function obterNotifications(): any | null {
  if (Platform.OS !== "android") return null;

  if (tentouCarregar) return modulo;

  tentouCarregar = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const N = require("expo-notifications");

    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    modulo = N;
  } catch (erro) {
    console.log("Notificações indisponíveis neste app:", erro);
    modulo = null;
  }

  return modulo;
}

async function prepararCanal(N: any) {
  await N.setNotificationChannelAsync(CANAL, {
    name: "Aluguéis",
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

// Android 13+ exige permissão. Pede só se ainda não foi concedida.
export async function permitirNotificacoes(): Promise<boolean> {
  const N = obterNotifications();
  if (!N) return false;

  try {
    const atual = await N.getPermissionsAsync();
    if (atual.granted) return true;

    const nova = await N.requestPermissionsAsync();
    return nova.granted;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Datas
// ---------------------------------------------------------------

function formatarData(iso?: string): string {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Converte "2026-12-02" (ou ISO completo) em uma data LOCAL,
// no horário pedido, para o aviso disparar na hora certa do usuário.
function dataLocal(
  iso: string | undefined,
  diasAntes: number,
  hora: number
): Date | null {
  if (!iso) return null;

  const [ano, mes, dia] = String(iso)
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (!ano || !mes || !dia) return null;

  return new Date(ano, mes - 1, dia - diasAntes, hora, 0, 0, 0);
}

// ---------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------

async function agendar(
  N: any,
  identificador: string,
  quando: Date,
  titulo: string,
  corpo: string
) {
  // Não agenda no passado.
  if (quando.getTime() <= Date.now() + 5000) return;

  await N.scheduleNotificationAsync({
    identifier: identificador,
    content: { title: titulo, body: corpo, sound: true },
    trigger: {
      type: N.SchedulableTriggerInputTypes?.DATE ?? "date",
      date: quando,
      channelId: CANAL,
    },
  });
}

// Cancela todos os lembretes de um livro (útil antes de reagendar).
export async function cancelarLembretesAluguel(livroId: number) {
  const N = obterNotifications();
  if (!N) return;

  try {
    const agendadas = await N.getAllScheduledNotificationsAsync();

    await Promise.all(
      agendadas
        .filter((n: any) => n.identifier.startsWith(`aluguel-${livroId}-`))
        .map((n: any) => N.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (erro) {
    console.log("Erro ao cancelar lembretes:", erro);
  }
}

/**
 * Agenda os lembretes de um aluguel: aluguel, leitura e devolução.
 * Nunca lança erro: se falhar, o aluguel continua valendo.
 */
export async function agendarLembretesAluguel(
  livroId: number,
  nomeLivro: string,
  dataFim?: string
) {
  try {
    const N = obterNotifications();
    if (!N) return;

    await prepararCanal(N);

    if (!(await permitirNotificacoes())) return;

    // Evita duplicar se o aluguel for renovado.
    await cancelarLembretesAluguel(livroId);

    const prefixo = `aluguel-${livroId}`;
    const ate = formatarData(dataFim);

    // --- Lembrete de ALUGUEL: confirmação imediata ---
    await N.scheduleNotificationAsync({
      content: {
        title: "Livro alugado! 📚",
        body: ate
          ? `Você alugou "${nomeLivro}". Disponível até ${ate}.`
          : `Você alugou "${nomeLivro}". Boa leitura!`,
        sound: true,
      },
      trigger: null,
    });

    if (!dataFim) return;

    // --- Lembrete de ALUGUEL: faltam 3 dias ---
    const tresDias = dataLocal(dataFim, 3, HORA_DEVOLUCAO);
    if (tresDias) {
      await agendar(
        N,
        `${prefixo}-aluguel-3d`,
        tresDias,
        "Seu aluguel está acabando ⏳",
        `"${nomeLivro}" fica disponível por mais 3 dias (até ${ate}).`
      );
    }

    // --- Lembrete de LEITURA: 19h, nos próximos dias ---
    const fim = dataLocal(dataFim, 0, 23);
    for (let i = 1; i <= DIAS_LEMBRETE_LEITURA; i++) {
      const dia = new Date();
      dia.setDate(dia.getDate() + i);
      dia.setHours(HORA_LEITURA, 0, 0, 0);

      // Para de lembrar depois do vencimento.
      if (fim && dia.getTime() > fim.getTime()) break;

      await agendar(
        N,
        `${prefixo}-leitura-${i}`,
        dia,
        "Hora de ler! 📖",
        `Que tal continuar "${nomeLivro}" hoje?`
      );
    }

    // --- Lembrete de DEVOLUÇÃO: 1 dia antes e no dia ---
    const umDia = dataLocal(dataFim, 1, HORA_DEVOLUCAO);
    if (umDia) {
      await agendar(
        N,
        `${prefixo}-devolucao-1d`,
        umDia,
        "Devolução amanhã 🔔",
        `O aluguel de "${nomeLivro}" termina amanhã (${ate}).`
      );
    }

    const noDia = dataLocal(dataFim, 0, HORA_DEVOLUCAO);
    if (noDia) {
      await agendar(
        N,
        `${prefixo}-devolucao-0d`,
        noDia,
        "Último dia de leitura! ⚠️",
        `O aluguel de "${nomeLivro}" termina hoje (${ate}).`
      );
    }
  } catch (erro) {
    console.log("Erro ao agendar lembretes:", erro);
  }
}

// Mantida por compatibilidade: só avisa que o livro foi alugado.
export async function notificarAluguel(nomeLivro: string, dataFim?: string) {
  await agendarLembretesAluguel(0, nomeLivro, dataFim);
}