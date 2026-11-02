
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

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  autenticarBiometria,
  biometriaDisponivel,
  lerCredenciais,
  removerCredenciais,
} from "../Biometria";

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
  Inicio_Adm: {
    usuario: {
      nome: string;
      email: string;
    };
  };
};

type NavigationProps =
  NativeStackNavigationProp<RootStackParamList>;

interface Usuario {
  id: number;
  nome: string;
  email: string;
  credito: number;
  tipo: "admin" | "normal";
}

interface LoginResponse {
  usuario?: Usuario;
  token?: string;
  message?: string;
  mensagem?: string;
  erro?: string;
}

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

export default function Login() {
  const navigation = useNavigation<NavigationProps>();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [janelaModal, setModal] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarConta, setLembrarConta] = useState(true);
  const [bioPronta, setBioPronta] = useState(false);

  useEffect(() => {
    async function carregarContaLembrada() {
      try {
        const emailSalvo =
          await AsyncStorage.getItem("emailLembrado");

        if (emailSalvo) {
          setEmail(emailSalvo);
          setLembrarConta(true);
        }
      } catch (error) {
        console.log(
          "Erro ao carregar conta lembrada:",
          error
        );
      }
    }

    carregarContaLembrada();
  }, []);

  // Mostra o botão de biometria só no Android, com biometria cadastrada e ativada no Perfil.
  useFocusEffect(
    useCallback(() => {
      async function verificarBiometria() {
        if (Platform.OS !== "android") {
          setBioPronta(false);
          return;
        }

        const [disponivel, credenciais] = await Promise.all([
          biometriaDisponivel(),
          lerCredenciais(),
        ]);

        setBioPronta(disponivel && credenciais !== null);
      }

      verificarBiometria();
    }, [])
  );

  async function loginBiometrico(): Promise<void> {
    if (carregando) return;

    const credenciais = await lerCredenciais();

    if (!credenciais) {
      setBioPronta(false);
      return;
    }

    const ok = await autenticarBiometria("Entre no Paginarium com sua biometria");
    if (!ok) return;

    await realizarLogin(credenciais.email, credenciais.senha, true);
  }

  async function login(): Promise<void> {
    if (carregando) return;

    const emailLimpo = email.trim().toLowerCase();

    if (!emailLimpo || !senha) {
      setErro("Preencha seu e-mail e sua senha.");
      setModal(true);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro("Digite um endereço de e-mail válido.");
      setModal(true);
      return;
    }

    await realizarLogin(emailLimpo, senha);
  }

  async function realizarLogin(
    emailLimpo: string,
    senhaUsada: string,
    viaBiometria = false
  ): Promise<void> {
    setCarregando(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailLimpo,
          senha: senhaUsada,
        }),
      });

      const texto = await response.text();
      let data: LoginResponse = {};

      try {
        // A API devolve erros como texto JSON (ex.: "E-mail ou senha incorretos.")
        const lido = texto ? JSON.parse(texto) : {};
        data = typeof lido === "string" ? { message: lido } : lido;
      } catch {
        data = { message: texto };
      }

      // A senha guardada para a biometria deixou de valer (ex.: senha alterada).
      if (viaBiometria && response.status === 401) {
        await removerCredenciais();
        setBioPronta(false);
        setErro(
          "Sua senha mudou. Entre com e-mail e senha e ative a biometria novamente no Perfil."
        );
        setModal(true);
        return;
      }

      if (!response.ok) {
        setErro(
          data.message ||
            data.mensagem ||
            data.erro ||
            "E-mail ou senha incorretos."
        );
        setModal(true);
        return;
      }

      if (!data.token || !data.usuario) {
        setErro(
          "O servidor não retornou os dados esperados. Tente novamente."
        );
        setModal(true);
        return;
      }

      // Salva ou remove o e-mail lembrado.
      if (lembrarConta) {
        await AsyncStorage.setItem(
          "emailLembrado",
          emailLimpo
        );
      } else {
        await AsyncStorage.removeItem("emailLembrado");
      }

      // Salva os dados da sessão.
      await AsyncStorage.setItem("token", data.token);
      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(data.usuario)
      );

      // Redireciona conforme o tipo de usuário.
      if (data.usuario.tipo === "admin") {
        navigation.navigate("Inicio_Adm", {
          usuario: {
            nome: data.usuario.nome,
            email: data.usuario.email,
          },
        });
      } else {
        navigation.navigate("Inicio", {
          usuario: {
            id: data.usuario.id,
            nome: data.usuario.nome,
            email: data.usuario.email,
            credito: data.usuario.credito,
            tipo: data.usuario.tipo,
          },
          token: data.token,
        });
      }
    } catch (error) {
      console.log("ERRO NO LOGIN:", error);

      setErro(
        "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
      );
      setModal(true);
    } finally {
      setCarregando(false);
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
        style={estilo.tela}
      >
        <ScrollView
          contentContainerStyle={estilo.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          <View style={estilo.container}>
            <View style={estilo.cartao}>
              <View style={estilo.logoContainer}>
                <Image
                  source={require("../assets/Paginarium_icon.png")}
                  style={estilo.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={estilo.titulo}>
                Bem-vindo de volta!
              </Text>

              <Text style={estilo.descricao}>
                Entre na sua conta para continuar.
              </Text>

              <View style={estilo.formulario}>
                <Text style={estilo.label}>E-mail</Text>

                <TextInput
                  placeholder="Digite seu e-mail"
                  placeholderTextColor={CORES.textoSecundario}
                  style={estilo.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!carregando}
                  returnKeyType="next"
                  accessibilityLabel="E-mail"
                />

                <Text style={estilo.label}>Senha</Text>

                <View style={estilo.senhaContainer}>
                  <TextInput
                    placeholder="Digite sua senha"
                    placeholderTextColor={CORES.textoSecundario}
                    style={estilo.inputSenha}
                    value={senha}
                    onChangeText={setSenha}
                    secureTextEntry={!mostrarSenha}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!carregando}
                    returnKeyType="done"
                    onSubmitEditing={login}
                    accessibilityLabel="Senha"
                  />

                  <TouchableOpacity
                    style={estilo.botaoMostrar}
                    onPress={() =>
                      setMostrarSenha(!mostrarSenha)
                    }
                    disabled={carregando}
                    activeOpacity={0.7}
                  >
                    <Text style={estilo.textoMostrar}>
                      {mostrarSenha ? "Ocultar" : "Mostrar"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Lembrar minha conta */}
                <TouchableOpacity
                  style={estilo.lembrarContainer}
                  onPress={() =>
                    setLembrarConta(!lembrarConta)
                  }
                  activeOpacity={0.7}
                  disabled={carregando}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: lembrarConta,
                  }}
                >
                  <View
                    style={[
                      estilo.checkbox,
                      lembrarConta &&
                        estilo.checkboxAtivo,
                    ]}
                  >
                    {lembrarConta && (
                      <Text style={estilo.checkTexto}>
                        ✓
                      </Text>
                    )}
                  </View>

                  <Text style={estilo.lembrarTexto}>
                    Lembrar minha conta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    estilo.botaoLogin,
                    carregando &&
                      estilo.botaoDesabilitado,
                  ]}
                  onPress={login}
                  disabled={carregando}
                  activeOpacity={0.8}
                >
                  {carregando ? (
                    <View
                      style={estilo.carregandoContainer}
                    >
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={estilo.textoBotao}>
                        Entrando...
                      </Text>
                    </View>
                  ) : (
                    <Text style={estilo.textoBotao}>
                      Entrar
                    </Text>
                  )}
                </TouchableOpacity>
                {bioPronta && (
                  <TouchableOpacity
                    style={estilo.botaoBiometria}
                    onPress={loginBiometrico}
                    disabled={carregando}
                    activeOpacity={0.8}
                  >
                    <Text style={estilo.textoBiometria}>
                      🔐  Entrar com biometria
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={estilo.divisorContainer}>
                <View style={estilo.divisor} />
                <Text style={estilo.textoDivisor}>
                  OU
                </Text>
                <View style={estilo.divisor} />
              </View>

              <TouchableOpacity
                style={estilo.botaoCadastro}
                onPress={() =>
                  navigation.navigate("Cadastro")
                }
                disabled={carregando}
                activeOpacity={0.7}
              >
                <Text style={estilo.textoCadastro}>
                  Criar uma conta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={estilo.rodape}>
              PAGINARIUM
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={janelaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <View style={modalStyles.fundo}>
          <View style={modalStyles.caixa}>
            <View style={modalStyles.iconeErro}>
              <Text style={modalStyles.exclamacao}>
                !
              </Text>
            </View>

            <Text style={modalStyles.titulo}>
              Não foi possível entrar
            </Text>

            <Text style={modalStyles.mensagem}>
              {erro}
            </Text>

            <TouchableOpacity
              style={modalStyles.botao}
              onPress={() => setModal(false)}
              activeOpacity={0.8}
            >
              <Text style={modalStyles.textoBotao}>
                Entendi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const estilo = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  conteudo: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    minHeight: 650,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  cartao: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: CORES.cartao,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 25,
    paddingVertical: 28,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 180,
    height: 145,
  },
  titulo: {
    color: CORES.texto,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },
  descricao: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 30,
  },
  formulario: {
    width: "100%",
  },
  label: {
    color: CORES.texto,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 5,
  },
  input: {
    width: "100%",
    height: 52,
    backgroundColor: CORES.campo,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: CORES.texto,
    fontSize: 15,
    marginBottom: 17,
  },
  senhaContainer: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CORES.campo,
    borderColor: CORES.borda,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 14,
  },
  inputSenha: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    color: CORES.texto,
    fontSize: 15,
  },
  botaoMostrar: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textoMostrar: {
    color: CORES.laranja,
    fontSize: 12,
    fontWeight: "700",
  },
  lembrarContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 4,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: CORES.borda,
    backgroundColor: CORES.campo,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxAtivo: {
    backgroundColor: CORES.vermelho,
    borderColor: CORES.vermelho,
  },
  checkTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  lembrarTexto: {
    color: CORES.textoSecundario,
    fontSize: 13,
    fontWeight: "500",
  },
  botaoLogin: {
    width: "100%",
    minHeight: 52,
    backgroundColor: CORES.vermelho,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    elevation: 3,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoBiometria: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.vermelho,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  textoBiometria: {
    color: CORES.vermelho,
    fontSize: 15,
    fontWeight: "800",
  },
  carregandoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textoBotao: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  divisorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 22,
  },
  divisor: {
    flex: 1,
    height: 1,
    backgroundColor: CORES.borda,
  },
  textoDivisor: {
    color: CORES.textoSecundario,
    fontSize: 11,
    fontWeight: "700",
    marginHorizontal: 12,
  },
  botaoCadastro: {
    width: "100%",
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.laranja,
    justifyContent: "center",
    alignItems: "center",
  },
  textoCadastro: {
    color: CORES.laranja,
    fontSize: 15,
    fontWeight: "700",
  },
  rodape: {
    color: "#656579",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 24,
  },
});

const modalStyles = StyleSheet.create({
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CORES.borda,
    padding: 25,
    alignItems: "center",
  },
  iconeErro: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B1926",
    borderWidth: 1,
    borderColor: CORES.vermelho,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },
  exclamacao: {
    color: CORES.vermelho,
    fontSize: 27,
    fontWeight: "800",
  },
  titulo: {
    color: CORES.texto,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  mensagem: {
    color: CORES.textoSecundario,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 23,
  },
  botao: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: CORES.vermelho,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotao: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
