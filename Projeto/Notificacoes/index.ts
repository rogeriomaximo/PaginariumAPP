import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Notificação local (não precisa de servidor de push).
 * Na web não faz nada: o app só usa notificação no Android.
 */

if (Platform.OS === "android") {
  Notifications.setNotificationHandler({
    handleNotification: async () =>
      ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }) as any,
  });
}

const CANAL = "alugueis";

async function prepararCanal() {
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: "Aluguéis",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

// Android 13+ exige permissão. Pede só se ainda não foi concedida.
export async function permitirNotificacoes(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted) return true;

    const nova = await Notifications.requestPermissionsAsync();
    return nova.granted;
  } catch {
    return false;
  }
}

function formatarData(iso?: string): string {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Avisa que o livro foi alugado. Nunca lança erro: se falhar, o aluguel continua valendo.
export async function notificarAluguel(nomeLivro: string, dataFim?: string) {
  if (Platform.OS !== "android") return;

  try {
    await prepararCanal();

    if (!(await permitirNotificacoes())) return;

    const ate = formatarData(dataFim);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Livro alugado! 📚",
        body: ate
          ? `Você alugou "${nomeLivro}". Disponível até ${ate}.`
          : `Você alugou "${nomeLivro}". Boa leitura!`,
        sound: true,
      },
      trigger: null,
    });
  } catch (erro) {
    console.log("Erro ao notificar aluguel:", erro);
  }
}
