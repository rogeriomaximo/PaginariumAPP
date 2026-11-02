import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { autenticarBiometria, biometriaDisponivel } from "../Biometria";

const BASE = "https://paginariumapi.onrender.com";

/**
 * Confirmação antes de alugar:
 *  - Android com biometria cadastrada  -> pede digital/rosto
 *  - biometria cancelada ou falhou     -> cai para a senha
 *  - sem biometria, ou na web          -> pede a senha da conta
 *
 * Uso:
 *   const { confirmar, modalSenha } = useConfirmarAluguel(token);
 *   const ok = await confirmar("Confirme o aluguel de X");
 *   ...e renderize {modalSenha} em qualquer lugar do JSX da tela.
 */
export function useConfirmarAluguel(token: string) {
  const [visivel, setVisivel] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const finalizar = useCallback((ok: boolean) => {
    setVisivel(false);
    setSenha("");
    setErro("");
    setMostrar(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const pedirSenha = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setSenha("");
        setErro("");
        setVisivel(true);
      }),
    []
  );

  const confirmar = useCallback(
    async (motivo = "Confirme para alugar o livro"): Promise<boolean> => {
      if (Platform.OS === "android" && (await biometriaDisponivel())) {
        if (await autenticarBiometria(motivo)) return true;
        // Cancelou ou não reconheceu: oferece a senha como alternativa.
      }

      return pedirSenha();
    },
    [pedirSenha]
  );

  async function enviarSenha() {
    if (verificando) return;

    if (!senha) {
      setErro("Digite sua senha.");
      return;
    }

    setVerificando(true);
    setErro("");

    try {
      const res = await fetch(`${BASE}/confirmar-senha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ senha }),
      });

      if (res.ok) {
        finalizar(true);
        return;
      }

      if (res.status === 400) setErro("Senha incorreta.");
      else if (res.status === 429)
        setErro("Muitas tentativas. Aguarde alguns minutos.");
      else if (res.status === 401)
        setErro("Sessão expirada. Entre novamente no app.");
      else setErro("Não foi possível confirmar a senha. Tente novamente.");
    } catch {
      setErro("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setVerificando(false);
    }
  }

  const modalSenha = (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={() => finalizar(false)}
    >
      <View style={estilo.fundo}>
        <View style={estilo.caixa}>
          <Text style={estilo.titulo}>Confirmar aluguel</Text>
          <Text style={estilo.descricao}>
            Digite a senha da sua conta para continuar.
          </Text>

          <TextInput
            value={senha}
            onChangeText={(t) => {
              setSenha(t);
              setErro("");
            }}
            onSubmitEditing={enviarSenha}
            placeholder="Sua senha"
            placeholderTextColor="#A5A5B8"
            secureTextEntry={!mostrar}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!verificando}
            style={estilo.input}
          />

          <TouchableOpacity
            onPress={() => setMostrar(!mostrar)}
            style={estilo.mostrar}
          >
            <Text style={estilo.mostrarTexto}>
              {mostrar ? "Ocultar senha" : "Mostrar senha"}
            </Text>
          </TouchableOpacity>

          {!!erro && <Text style={estilo.erro}>{erro}</Text>}

          <TouchableOpacity
            onPress={enviarSenha}
            disabled={verificando}
            activeOpacity={0.8}
            style={[estilo.botao, verificando && { opacity: 0.7 }]}
          >
            {verificando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={estilo.botaoTexto}>Confirmar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => finalizar(false)}
            disabled={verificando}
            style={estilo.cancelar}
          >
            <Text style={estilo.cancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return { confirmar, modalSenha };
}

const estilo = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  caixa: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#191927",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#373747",
    padding: 24,
  },
  titulo: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  descricao: {
    color: "#A5A5B8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
  },
  input: {
    height: 50,
    backgroundColor: "#222231",
    borderColor: "#373747",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontSize: 15,
  },
  mostrar: {
    alignSelf: "flex-end",
    paddingVertical: 8,
  },
  mostrarTexto: {
    color: "#FF8A24",
    fontSize: 12,
    fontWeight: "700",
  },
  erro: {
    color: "#FF2638",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  botao: {
    minHeight: 48,
    backgroundColor: "#FF2638",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  botaoTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  cancelar: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelarTexto: {
    color: "#A5A5B8",
    fontSize: 13,
    fontWeight: "600",
  },
});
