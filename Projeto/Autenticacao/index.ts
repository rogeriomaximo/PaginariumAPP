import { Platform } from "react-native";

export type ModoAutenticacao = "biometria" | "senha";

type ModuloBiometria = typeof import("expo-local-authentication");

// Carrega o módulo nativo só quando precisa e dentro de try/catch:
// se o build não tiver o expo-local-authentication, o app abre normalmente
// e o aluguel usa a confirmação por senha.
function carregarModulo(): ModuloBiometria | null {
  if (Platform.OS === "web") return null;

  try {
    return require("expo-local-authentication") as ModuloBiometria;
  } catch (erro) {
    console.log("expo-local-authentication indisponível neste build:", erro);
    return null;
  }
}

// Web (PC) -> sempre senha.
// Android/iOS -> biometria se o aparelho tiver sensor E houver biometria
// cadastrada; caso contrário, senha.
export async function detectarModoAutenticacao(): Promise<ModoAutenticacao> {
  const LocalAuthentication = carregarModulo();
  if (!LocalAuthentication) return "senha";

  try {
    const temHardware = await LocalAuthentication.hasHardwareAsync();
    const temCadastrada = await LocalAuthentication.isEnrolledAsync();
    return temHardware && temCadastrada ? "biometria" : "senha";
  } catch (erro) {
    console.log("Erro ao detectar biometria:", erro);
    return "senha";
  }
}

export async function autenticarBiometria(mensagem: string): Promise<boolean> {
  const LocalAuthentication = carregarModulo();
  if (!LocalAuthentication) return false;

  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: mensagem,
      cancelLabel: "Usar senha",
      disableDeviceFallback: true,
    });
    return resultado.success;
  } catch (erro) {
    console.log("Erro na biometria:", erro);
    return false;
  }
}