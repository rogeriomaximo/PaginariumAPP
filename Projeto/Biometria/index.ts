import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

/**
 * Biometria só existe no Android. Na web tudo aqui devolve "indisponível"
 * e o app usa apenas a senha.
 */

const CHAVE_CREDENCIAIS = "credenciaisBiometria";

export type Credenciais = { email: string; senha: string };

// O aparelho tem sensor E o usuário cadastrou digital/rosto nele?
export async function biometriaDisponivel(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    const temSensor = await LocalAuthentication.hasHardwareAsync();
    if (!temSensor) return false;

    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

// Abre o prompt de biometria do Android. true = autenticou.
export async function autenticarBiometria(motivo: string): Promise<boolean> {
  if (!(await biometriaDisponivel())) return false;

  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: "Cancelar",
      disableDeviceFallback: true,
    });

    return resultado.success;
  } catch {
    return false;
  }
}

// ---- Credenciais guardadas no cofre do Android (Keystore), usadas no login por biometria ----

export async function salvarCredenciais(email: string, senha: string) {
  if (Platform.OS !== "android") return;

  await SecureStore.setItemAsync(
    CHAVE_CREDENCIAIS,
    JSON.stringify({ email, senha })
  );
}

export async function lerCredenciais(): Promise<Credenciais | null> {
  if (Platform.OS !== "android") return null;

  try {
    const bruto = await SecureStore.getItemAsync(CHAVE_CREDENCIAIS);
    if (!bruto) return null;

    const dados = JSON.parse(bruto);
    if (typeof dados?.email === "string" && typeof dados?.senha === "string") {
      return dados;
    }
    return null;
  } catch {
    return null;
  }
}

export async function removerCredenciais() {
  if (Platform.OS !== "android") return;

  try {
    await SecureStore.deleteItemAsync(CHAVE_CREDENCIAIS);
  } catch {
    // nada a remover
  }
}

export async function biometriaAtiva(): Promise<boolean> {
  return (await lerCredenciais()) !== null;
}
