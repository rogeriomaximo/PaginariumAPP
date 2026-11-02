import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type ModoAutenticacao = "biometria" | "senha";

// Web (PC) -> sempre senha.
// Android/iOS -> biometria se o aparelho tiver sensor E houver biometria
// cadastrada; caso contrário, senha.
export async function detectarModoAutenticacao(): Promise<ModoAutenticacao> {
  if (Platform.OS === "web") return "senha";

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