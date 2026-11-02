
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  StatusBar,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  Inicio: {
    usuario: {
      id: number;
      nome: string;
      email: string;
      credito: number;
      tipo: string;
    };
    token: string;
  };
};

type NavigationProps =
  NativeStackNavigationProp<RootStackParamList>;

const API_URL = "https://paginariumapi.onrender.com";

const CORES = {
  fundo: "#10101C",
  cartao: "#191927",
  campo: "#222231",
  borda: "#373747",
  vermelho: "#FF2638",
  laranja: "#FF8A24",
  texto: "#FFFFFF",
  textoSecundario: "#A5A5B8",
};

function interpretarResposta(texto: string): any {
  if (!texto) return {};

  try {
    return JSON.parse(texto);
  } catch {
    return { message: texto };
  }
}

function mensagemDaResposta(data: any, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data?.mensagem === "string" && data.mensagem.trim()) {
    return data.mensagem;
  }
  if (typeof data?.erro === "string" && data.erro.trim()) {
    return data.erro;
  }

  return fallback;
}

export default function Cadastro() {
  const navigation = useNavigation<NavigationProps>();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [erro, setErro] = useState("");
  const [janelaModal, setModal] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  function mostrarErro(mensagem: string) {
    setErro(mensagem);
    setModal(true);
  }

  async function cadastro(): Promise<void> {
    if (cadastrando) return;

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const emailConfirmado = confirmarEmail.trim().toLowerCase();

    if (
      !nomeLimpo ||
      !emailLimpo ||
      !emailConfirmado ||
      !senha ||
      !confirmarSenha
    ) {
      mostrarErro("Preencha todos os campos.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      mostrarErro("Digite um endereço de e-mail válido.");
      return;
    }

    if (emailLimpo !== emailConfirmado) {
      mostrarErro("Os e-mails não coincidem.");
      return;
    }

    if (senha !== confirmarSenha) {
      mostrarErro("As senhas não coincidem.");
      return;
    }

    if (senha.length < 6) {
      mostrarErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setCadastrando(true);

    try {
      const response = await fetch(`${API_URL}/cadastro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nomeLimpo,
          email: emailLimpo,
          senha,
        }),
      });

      const responseText = await response.text();
      const data = interpretarResposta(responseText);

      if (!response.ok) {
        mostrarErro(
          mensagemDaResposta(
            data,
            `Não foi possível concluir o cadastro (HTTP ${response.status}).`
          )
        );
        return;
      }

      // Cadastro concluído: tenta entrar automaticamente.
      let loginRes: Response;

      try {
        loginRes = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailLimpo,
            senha,
          }),
        });
      } catch {
        mostrarErro(
          "Cadastro concluído, mas não foi possível entrar automaticamente. Acesse a tela de Login e entre com sua conta."
        );
        return;
      }

      const loginText = await loginRes.text();
      const loginData = interpretarResposta(loginText);

      if (
        !loginRes.ok ||
        typeof loginData?.token !== "string" ||
        !loginData?.usuario
      ) {
        mostrarErro(
          "Sua conta foi cadastrada, mas o login automático não funcionou. Entre pela tela de Login."
        );
        return;
      }

      await AsyncStorage.setItem("token", loginData.token);
      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(loginData.usuario)
      );

      navigation.navigate("Inicio", {
        usuario: loginData.usuario,
        token: loginData.token,
      });
    } catch (error) {
      console.log("ERRO NO CADASTRO:", error);

      mostrarErro(
        "Não foi possível confirmar a resposta do servidor. Se a conta já tiver sido criada, tente entrar pela tela de Login em vez de cadastrá-la novamente."
      );
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <>
      <StatusBar
        backgroundColor={CORES.fundo}
        barStyle="light-content"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.tela}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.card}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/Paginarium_icon.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.title}>Crie sua conta</Text>

              <Text style={styles.description}>
                Preencha os campos para começar.
              </Text>

              <View style={styles.formulario}>
                <Text style={styles.label}>Nome completo</Text>

                <TextInput
                  placeholder="Digite seu nome"
                  placeholderTextColor={CORES.textoSecundario}
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!cadastrando}
                  returnKeyType="next"
                />

                <Text style={styles.label}>E-mail</Text>

                <TextInput
                  placeholder="Digite seu e-mail"
                  placeholderTextColor={CORES.textoSecundario}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!cadastrando}
                  returnKeyType="next"
                />

                <Text style={styles.label}>Confirmar e-mail</Text>

                <TextInput
                  placeholder="Digite seu e-mail novamente"
                  placeholderTextColor={CORES.textoSecundario}
                  style={styles.input}
                  value={confirmarEmail}
                  onChangeText={setConfirmarEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!cadastrando}
                  returnKeyType="next"
                />

                <Text style={styles.label}>Senha</Text>

                <TextInput
                  placeholder="Crie uma senha"
                  placeholderTextColor={CORES.textoSecundario}
                  style={styles.input}
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!mostrarSenhas}
                  autoCapitalize="none"
                  editable={!cadastrando}
                  returnKeyType="next"
                />

                <Text style={styles.label}>Confirmar senha</Text>

                <TextInput
                  placeholder="Digite a senha novamente"
                  placeholderTextColor={CORES.textoSecundario}
                  style={styles.input}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry={!mostrarSenhas}
                  autoCapitalize="none"
                  editable={!cadastrando}
                  returnKeyType="done"
                  onSubmitEditing={cadastro}
                />

                <TouchableOpacity
                  style={styles.mostrarContainer}
                  onPress={() => setMostrarSenhas(!mostrarSenhas)}
                  disabled={cadastrando}
                >
                  <Text style={styles.mostrarTexto}>
                    {mostrarSenhas ? "Ocultar senhas" : "Mostrar senhas"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={cadastro}
                  style={[
                    styles.button,
                    cadastrando && styles.buttonDesabilitado,
                  ]}
                  disabled={cadastrando}
                  activeOpacity={0.8}
                >
                  {cadastrando ? (
                    <View style={styles.carregandoContainer}>
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={styles.buttonText}>
                        Cadastrando...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>
                      Criar minha conta
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.divisorContainer}>
                <View style={styles.divisor} />
                <Text style={styles.divisorTexto}>OU</Text>
                <View style={styles.divisor} />
              </View>

              <TouchableOpacity
                style={styles.botaoLogin}
                onPress={() => navigation.navigate("Login")}
                disabled={cadastrando}
                activeOpacity={0.7}
              >
                <Text style={styles.botaoLoginTexto}>
                  Já tenho uma conta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.rodape}>PAGINARIUM</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={janelaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <View style={modal.fundo}>
          <View style={modal.caixa}>
            <View style={modal.icone}>
              <Text style={modal.exclamacao}>!</Text>
            </View>

            <Text style={modal.titulo}>
              Atenção
            </Text>

            <Text style={modal.mensagem}>
              {erro}
            </Text>

            <TouchableOpacity
              onPress={() => setModal(false)}
              style={modal.botao}
              activeOpacity={0.8}
            >
              <Text style={modal.botaoTexto}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },

  conteudo: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 25,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: CORES.cartao,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 23,
    paddingVertical: 25,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 8,
  },

  logo: {
    width: 150,
    height: 115,
  },

  title: {
    color: CORES.texto,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },

  description: {
    color: CORES.textoSecundario,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 25,
  },

  formulario: {
    width: "100%",
  },

  label: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 3,
  },

  input: {
    width: "100%",
    height: 49,
    backgroundColor: CORES.campo,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    color: CORES.texto,
    fontSize: 14,
    marginBottom: 13,
  },

  mostrarContainer: {
    alignSelf: "flex-end",
    paddingVertical: 5,
    marginBottom: 12,
  },

  mostrarTexto: {
    color: CORES.laranja,
    fontSize: 12,
    fontWeight: "700",
  },

  button: {
    width: "100%",
    minHeight: 51,
    backgroundColor: CORES.vermelho,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    elevation: 3,
  },

  buttonDesabilitado: {
    opacity: 0.7,
  },

  carregandoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  divisorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 23,
    marginBottom: 19,
  },

  divisor: {
    flex: 1,
    height: 1,
    backgroundColor: CORES.borda,
  },

  divisorTexto: {
    color: CORES.textoSecundario,
    fontSize: 10,
    fontWeight: "700",
    marginHorizontal: 12,
  },

  botaoLogin: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.laranja,
    justifyContent: "center",
    alignItems: "center",
  },

  botaoLoginTexto: {
    color: CORES.laranja,
    fontSize: 14,
    fontWeight: "700",
  },

  rodape: {
    color: "#656579",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 22,
  },
});

const modal = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },

  caixa: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: CORES.cartao,
    padding: 25,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CORES.borda,
    alignItems: "center",
  },

  icone: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#3B1926",
    borderWidth: 1,
    borderColor: CORES.vermelho,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  exclamacao: {
    color: CORES.vermelho,
    fontSize: 26,
    fontWeight: "800",
  },

  titulo: {
    color: CORES.texto,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 12,
  },

  mensagem: {
    color: CORES.textoSecundario,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },

  botao: {
    width: "100%",
    minHeight: 48,
    backgroundColor: CORES.vermelho,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  botaoTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
