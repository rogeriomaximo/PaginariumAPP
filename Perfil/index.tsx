import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Paginarium_icon from "../assets/Paginarium_icon.png";
import Lua from "../assets/Lua_PixelArt.png";
import Sol from "../assets/Sol_PixelArt.png";
import Logout from "../assets/Logout.png";
import Opcoes_Clara from "../assets/Opcoes_Clara.png";
import Opcoes_Escura from "../assets/Opcoes_Escura.png";
import Fechar from "../assets/Fechar.png";

import {
  autenticarBiometria,
  biometriaAtiva,
  biometriaDisponivel,
  removerCredenciais,
  salvarCredenciais,
} from "../Biometria";

// =====================================================
// API
// =====================================================

const BASE = "https://paginariumapi.onrender.com";

// ⚠️ AJUSTE AQUI se as rotas da sua API forem diferentes.
// Atualizar nome:   PUT  /usuarios/:id         body: { nome }
// Adicionar saldo:  POST /usuarios/:id/creditos body: { valor }
const urlAtualizarNome = (id: number) => `${BASE}/usuarios/${id}`;
const urlAdicionarCredito = (id: number) => `${BASE}/usuarios/${id}/creditos`;

const VALORES_RAPIDOS = [10, 20, 50, 100];
const CREDITO_MAXIMO_POR_RECARGA = 1000;

// =====================================================
// TIPOS
// =====================================================

interface Usuario {
  id: number;
  nome: string;
  email: string;
  credito: number;
  tipo: string;
}

type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  Inicio: { usuario: Usuario; token: string };
  LivrosAlugados: { usuario: Usuario; token: string };
  Perfil: { usuario: Usuario; token: string };
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;
type PerfilRouteProp = RouteProp<RootStackParamList, "Perfil">;

type Mensagem = { tipo: "sucesso" | "erro"; texto: string } | null;

// =====================================================
// COMPONENTE
// =====================================================

export default function Perfil() {
  const { width } = useWindowDimensions();
  const Mobile = width < 600;
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<PerfilRouteProp>();

  const [usuario, setUsuario] = useState<Usuario | undefined>(
    route.params?.usuario
  );
  const [token, setToken] = useState<string | null>(
    route.params?.token ?? null
  );
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [menuVisible, setMenuVisible] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Edição de nome
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [msgNome, setMsgNome] = useState<Mensagem>(null);

  // Adição de créditos
  const [valorCredito, setValorCredito] = useState("");
  const [adicionandoCredito, setAdicionandoCredito] = useState(false);
  const [msgCredito, setMsgCredito] = useState<Mensagem>(null);

  // Biometria (somente Android)
  const [bioDisponivel, setBioDisponivel] = useState(false);
  const [bioAtiva, setBioAtiva] = useState(false);
  const [pedindoSenhaBio, setPedindoSenhaBio] = useState(false);
  const [senhaBio, setSenhaBio] = useState("");
  const [processandoBio, setProcessandoBio] = useState(false);
  const [msgBio, setMsgBio] = useState<Mensagem>(null);

  // Refs para evitar recriar callbacks (e loop de recarregamento)
  const usuarioRef = useRef<Usuario | undefined>(usuario);
  const tokenRef = useRef<string | null>(token);

  const atualizarUsuario = useCallback(async (novo: Usuario) => {
    usuarioRef.current = novo;
    setUsuario(novo);
    await AsyncStorage.setItem("usuario", JSON.stringify(novo));
  }, []);

  const isDark = tema === "dark";
  const cores = isDark
    ? {
        fundo: "#050914",
        painel: "#0B1222",
        card: "#0E172A",
        borda: "#263550",
        texto: "#F4F7FF",
        secundario: "#A9B8D0",
        vermelho: "#FF2638",
        laranja: "#FF8126",
        campo: "#080F1E",
        verde: "#25A66A",
      }
    : {
        fundo: "#F2F4F9",
        painel: "#FFFFFF",
        card: "#FFFFFF",
        borda: "#D8DEEA",
        texto: "#171C2B",
        secundario: "#5D667A",
        vermelho: "#D91F35",
        laranja: "#C95D08",
        campo: "#F7F8FC",
        verde: "#1B8A57",
      };

  // ===================================================
  // HELPERS
  // ===================================================

  const fetchSemCache = async (url: string, options: RequestInit = {}) => {
    const separador = url.includes("?") ? "&" : "?";
    return fetch(`${url}${separador}_=${Date.now()}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.headers || {}),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");
    navigation.navigate("Login");
  };

  // Sessão expirada: navega primeiro (Alert não executa onPress na web).
  const sessaoExpirada = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");
    navigation.navigate("Login");
    Alert.alert("Sessão expirada", "Faça login novamente.");
  };

  const lerErro = async (res: Response, padrao: string) => {
    try {
      const data = await res.json();
      if (typeof data === "string") return data;
      return data?.erro || data?.error || data?.message || data?.mensagem || padrao;
    } catch {
      return padrao;
    }
  };

  // ===================================================
  // CARREGAR PERFIL
  // ===================================================

  const carregarPerfil = useCallback(async () => {
    try {
      setCarregando(true);

      const tokenSalvo =
        (await AsyncStorage.getItem("token")) ?? tokenRef.current;
      const usuarioSalvo = await AsyncStorage.getItem("usuario");

      let usuarioAtual = usuarioRef.current;
      if (usuarioSalvo) {
        try {
          usuarioAtual = JSON.parse(usuarioSalvo) as Usuario;
        } catch {
          // Mantém o usuário recebido pela navegação.
        }
      }

      if (!tokenSalvo || !usuarioAtual?.id) {
        navigation.navigate("Login");
        return;
      }

      tokenRef.current = tokenSalvo;
      setToken(tokenSalvo);

      const res = await fetchSemCache(`${BASE}/usuarios/${usuarioAtual.id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenSalvo}` },
      });

      if (res.status === 401 || res.status === 403) {
        await sessaoExpirada();
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      await atualizarUsuario({
        id: Number(data.id),
        nome: data.nome ?? usuarioAtual.nome,
        email: data.email ?? usuarioAtual.email,
        credito: Number(data.credito ?? usuarioAtual.credito ?? 0),
        tipo: data.tipo ?? usuarioAtual.tipo ?? "normal",
      });
    } catch (erro) {
      console.log("Erro ao carregar perfil:", erro);
      // O perfil continua mostrando os dados já conhecidos.
    } finally {
      setCarregando(false);
    }
  }, [navigation, atualizarUsuario]);

  useFocusEffect(
    useCallback(() => {
      carregarPerfil();
    }, [carregarPerfil])
  );

  // ===================================================
  // ALTERAR NOME
  // ===================================================

  const iniciarEdicaoNome = () => {
    setNovoNome(usuario?.nome ?? "");
    setMsgNome(null);
    setEditandoNome(true);
  };

  const cancelarEdicaoNome = () => {
    setEditandoNome(false);
    setNovoNome("");
    setMsgNome(null);
  };

  const salvarNome = async () => {
    const nomeLimpo = novoNome.trim().replace(/\s+/g, " ");

    if (!usuario || !token) {
      await sessaoExpirada();
      return;
    }

    if (nomeLimpo.length < 2) {
      setMsgNome({ tipo: "erro", texto: "O nome deve ter pelo menos 2 caracteres." });
      return;
    }

    if (nomeLimpo.length > 100) {
      setMsgNome({ tipo: "erro", texto: "O nome deve ter no máximo 100 caracteres." });
      return;
    }

    if (nomeLimpo === usuario.nome) {
      cancelarEdicaoNome();
      return;
    }

    try {
      setSalvandoNome(true);
      setMsgNome(null);

      const res = await fetch(urlAtualizarNome(usuario.id), {
        method: "PUT",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome: nomeLimpo }),
      });

      if (res.status === 401 || res.status === 403) {
        await sessaoExpirada();
        return;
      }

      if (!res.ok) {
        setMsgNome({
          tipo: "erro",
          texto: await lerErro(res, "Não foi possível alterar o nome."),
        });
        return;
      }

      await atualizarUsuario({ ...usuario, nome: nomeLimpo });

      setEditandoNome(false);
      setNovoNome("");
      setMsgNome({ tipo: "sucesso", texto: "Nome atualizado com sucesso!" });
    } catch (erro) {
      console.log("Erro ao alterar nome:", erro);
      setMsgNome({
        tipo: "erro",
        texto: "Sem conexão com o servidor. Tente novamente.",
      });
    } finally {
      setSalvandoNome(false);
    }
  };

  // ===================================================
  // ADICIONAR CRÉDITOS
  // ===================================================

  const valorNumerico = (() => {
    const n = parseFloat(valorCredito.replace(",", "."));
    return isNaN(n) ? 0 : n;
  })();

  const valorValido =
    valorNumerico > 0 && valorNumerico <= CREDITO_MAXIMO_POR_RECARGA;

  const onChangeValorCredito = (texto: string) => {
    // Só números e um separador decimal, com no máximo 2 casas.
    let limpo = texto.replace(/[^0-9.,]/g, "").replace(".", ",");
    const partes = limpo.split(",");
    if (partes.length > 2) limpo = `${partes[0]},${partes.slice(1).join("")}`;
    const [inteiro, decimal] = limpo.split(",");
    limpo =
      decimal !== undefined
        ? `${inteiro.slice(0, 5)},${decimal.slice(0, 2)}`
        : inteiro.slice(0, 5);
    setValorCredito(limpo);
    setMsgCredito(null);
  };

  const adicionarCreditos = async () => {
    if (!usuario || !token) {
      await sessaoExpirada();
      return;
    }

    if (!valorValido) {
      setMsgCredito({
        tipo: "erro",
        texto: `Informe um valor entre R$ 0,01 e R$ ${CREDITO_MAXIMO_POR_RECARGA.toFixed(2)}.`,
      });
      return;
    }

    const valor = Math.round(valorNumerico * 100) / 100;

    try {
      setAdicionandoCredito(true);
      setMsgCredito(null);

      const res = await fetch(urlAdicionarCredito(usuario.id), {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ valor }),
      });

      if (res.status === 401 || res.status === 403) {
        await sessaoExpirada();
        return;
      }

      if (!res.ok) {
        setMsgCredito({
          tipo: "erro",
          texto: await lerErro(res, "Não foi possível adicionar créditos."),
        });
        return;
      }

      let novoCredito = Number(usuario.credito) + valor;
      try {
        const data = await res.json();
        const doServidor = Number(data?.novo_credito ?? data?.credito);
        if (!isNaN(doServidor) && (data?.novo_credito ?? data?.credito) != null) {
          novoCredito = doServidor;
        }
      } catch {
        // Resposta sem JSON: usa o valor calculado localmente.
      }

      await atualizarUsuario({ ...usuario, credito: novoCredito });

      setValorCredito("");
      setMsgCredito({
        tipo: "sucesso",
        texto: `R$ ${valor.toFixed(2)} adicionados ao seu saldo!`,
      });
    } catch (erro) {
      console.log("Erro ao adicionar créditos:", erro);
      setMsgCredito({
        tipo: "erro",
        texto: "Sem conexão com o servidor. Tente novamente.",
      });
    } finally {
      setAdicionandoCredito(false);
    }
  };

  // ===================================================
  // BIOMETRIA (ENTRAR NO APP)
  // ===================================================

  useEffect(() => {
    async function verificarBiometria() {
      if (Platform.OS !== "android") return;
      setBioDisponivel(await biometriaDisponivel());
      setBioAtiva(await biometriaAtiva());
    }
    verificarBiometria();
  }, []);

  const alternarBiometria = async () => {
    setMsgBio(null);

    if (bioAtiva) {
      await removerCredenciais();
      setBioAtiva(false);
      setPedindoSenhaBio(false);
      setMsgBio({ tipo: "sucesso", texto: "Biometria desativada." });
      return;
    }

    setSenhaBio("");
    setPedindoSenhaBio(true);
  };

  const cancelarAtivacaoBio = () => {
    setPedindoSenhaBio(false);
    setSenhaBio("");
    setMsgBio(null);
  };

  const confirmarAtivacaoBio = async () => {
    if (processandoBio) return;

    if (!usuario || !token) {
      await sessaoExpirada();
      return;
    }

    if (!senhaBio) {
      setMsgBio({ tipo: "erro", texto: "Digite sua senha para continuar." });
      return;
    }

    try {
      setProcessandoBio(true);
      setMsgBio(null);

      // 1) confere a senha no servidor
      const res = await fetch(`${BASE}/confirmar-senha`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senha: senhaBio }),
      });

      if (res.status === 401) {
        await sessaoExpirada();
        return;
      }

      if (!res.ok) {
        setMsgBio({
          tipo: "erro",
          texto:
            res.status === 400
              ? "Senha incorreta."
              : await lerErro(res, "Não foi possível confirmar a senha."),
        });
        return;
      }

      // 2) confirma que a pessoa tem biometria no aparelho
      const ok = await autenticarBiometria(
        "Confirme sua biometria para ativar o acesso rápido"
      );

      if (!ok) {
        setMsgBio({ tipo: "erro", texto: "Biometria não confirmada." });
        return;
      }

      // 3) guarda e-mail e senha no cofre seguro do Android
      await salvarCredenciais(usuario.email, senhaBio);

      setBioAtiva(true);
      setPedindoSenhaBio(false);
      setSenhaBio("");
      setMsgBio({
        tipo: "sucesso",
        texto: "Biometria ativada! Use-a na tela de login.",
      });
    } catch (erro) {
      console.log("Erro ao ativar biometria:", erro);
      setMsgBio({
        tipo: "erro",
        texto: "Não foi possível ativar a biometria. Tente novamente.",
      });
    } finally {
      setProcessandoBio(false);
    }
  };

  // ===================================================
  // NAVEGAÇÃO
  // ===================================================

  const irInicio = () => {
    if (usuario && token) navigation.navigate("Inicio", { usuario, token });
  };

  const irMeusLivros = () => {
    if (usuario && token) {
      navigation.navigate("LivrosAlugados", { usuario, token });
    }
  };

  const MenuLink = ({
    label,
    onPress,
    active = false,
  }: {
    label: string;
    onPress: () => void;
    active?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.navItem,
        active && { backgroundColor: isDark ? "#17243B" : "#EEF1F8" },
      ]}
    >
      <Text
        style={[
          styles.navLabel,
          { color: active ? cores.laranja : cores.secundario },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderMensagem = (msg: Mensagem) =>
    msg ? (
      <Text
        style={[
          styles.feedback,
          { color: msg.tipo === "sucesso" ? cores.verde : cores.vermelho },
        ]}
      >
        {msg.texto}
      </Text>
    ) : null;

  // ===================================================
  // INTERFACE
  // ===================================================

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.app, { backgroundColor: cores.fundo }]}>
        {!Mobile && (
          <View
            style={[
              styles.sidebar,
              { backgroundColor: cores.painel, borderColor: cores.borda },
            ]}
          >
            <View style={styles.brandRow}>
              <Image
                source={Paginarium_icon}
                style={styles.brandIcon}
                resizeMode="contain"
              />
              <Text style={[styles.brandName, { color: cores.texto }]}>
                PAGINARIUM
              </Text>
            </View>
            <MenuLink label="Início" onPress={irInicio} />
            <MenuLink label="Meus Livros" onPress={irMeusLivros} />
            <MenuLink label="Perfil" onPress={() => {}} active />
            <View style={styles.sidebarFooter}>
              <Text style={styles.sidebarBook}>📕</Text>
              <Text style={[styles.sidebarMotto, { color: cores.secundario }]}>
                GRANDES HISTÓRIAS
              </Text>
              <Text style={[styles.sidebarMotto, { color: cores.secundario }]}>
                COMEÇAM AQUI.
              </Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <SafeAreaView
            edges={["top"]}
            style={[
              styles.topbar,
              {
                backgroundColor: cores.painel,
                borderBottomColor: cores.vermelho,
              },
            ]}
          >
            {Mobile && (
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerIconButton}
              >
                <Image
                  source={isDark ? Opcoes_Clara : Opcoes_Escura}
                  style={styles.headerIcon}
                />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: cores.texto }]}>
                Meu Perfil
              </Text>
              <Text style={[styles.greetingSub, { color: cores.secundario }]}>
                Gerencie os dados da sua conta
              </Text>
            </View>
            <View style={[styles.creditPill, { borderColor: cores.borda }]}>
              <Text style={{ fontSize: 18 }}>▣</Text>
              <View>
                <Text style={[styles.creditLabel, { color: cores.secundario }]}>
                  Créditos
                </Text>
                <Text style={[styles.creditValue, { color: cores.laranja }]}>
                  R$ {Number(usuario?.credito ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setTema((atual) => actualTema(atual))}
              style={[styles.themeButton, { borderColor: cores.borda }]}
            >
              <Image source={isDark ? Sol : Lua} style={styles.headerIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={logout}
              style={[styles.logoutButton, { borderColor: cores.vermelho }]}
            >
              <Image source={Logout} style={styles.logoutIcon} />
              {!Mobile && (
                <Text style={{ color: cores.vermelho, fontWeight: "700" }}>
                  Sair
                </Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: Mobile ? 14 : 28,
              paddingTop: 24,
              paddingBottom: 36,
            }}
          >
            {/* CABEÇALHO DO PERFIL */}
            <View
              style={[
                styles.pageHeading,
                { borderColor: cores.borda, backgroundColor: cores.painel },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: cores.laranja }]}>
                <Text style={styles.avatarText}>
                  {(usuario?.nome?.trim()?.[0] ?? "U").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.profileName, { color: cores.texto }]}>
                  {usuario?.nome ?? "Usuário"}
                </Text>
                <Text style={[styles.profileEmail, { color: cores.secundario }]}>
                  {usuario?.email ?? "E-mail não informado"}
                </Text>
                <View
                  style={[
                    styles.accountBadge,
                    { backgroundColor: isDark ? "#18243A" : "#FFF0E4" },
                  ]}
                >
                  <Text
                    style={[styles.accountBadgeText, { color: cores.laranja }]}
                  >
                    {usuario?.tipo ?? "normal"}
                  </Text>
                </View>
              </View>
            </View>

            {/* INFORMAÇÕES DA CONTA */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>👤</Text>
              <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                Informações da conta
              </Text>
              <View
                style={[styles.sectionLine, { backgroundColor: cores.vermelho }]}
              />
            </View>

            <View
              style={[
                styles.infoPanel,
                { backgroundColor: cores.painel, borderColor: cores.borda },
              ]}
            >
              {/* NOME (editável) */}
              <View
                style={[
                  styles.infoRow,
                  { borderBottomWidth: 1, borderBottomColor: cores.borda },
                ]}
              >
                <View style={styles.infoRowHeader}>
                  <Text style={[styles.infoLabel, { color: cores.secundario }]}>
                    Nome completo
                  </Text>
                  {!editandoNome && (
                    <TouchableOpacity
                      onPress={iniciarEdicaoNome}
                      style={[styles.editButton, { borderColor: cores.laranja }]}
                    >
                      <Text
                        style={[styles.editButtonText, { color: cores.laranja }]}
                      >
                        ✎ Editar
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {editandoNome ? (
                  <View style={{ gap: 10 }}>
                    <TextInput
                      value={novoNome}
                      onChangeText={(t) => {
                        setNovoNome(t.slice(0, 100));
                        setMsgNome(null);
                      }}
                      onSubmitEditing={salvarNome}
                      returnKeyType="done"
                      autoFocus
                      editable={!salvandoNome}
                      placeholder="Digite seu nome"
                      placeholderTextColor={cores.secundario}
                      underlineColorAndroid="transparent"
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: cores.campo,
                          borderColor: cores.borda,
                          color: cores.texto,
                        },
                      ]}
                    />
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        onPress={salvarNome}
                        disabled={salvandoNome}
                        style={[
                          styles.smallPrimary,
                          {
                            backgroundColor: salvandoNome
                              ? "#626B7B"
                              : cores.vermelho,
                          },
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>
                          {salvandoNome ? "Salvando..." : "Salvar"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={cancelarEdicaoNome}
                        disabled={salvandoNome}
                        style={[
                          styles.smallSecondary,
                          {
                            borderColor: cores.borda,
                            backgroundColor: cores.card,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.secondaryButtonText,
                            { color: cores.texto },
                          ]}
                        >
                          Cancelar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.infoValue, { color: cores.texto }]}>
                    {usuario?.nome || "Não informado"}
                  </Text>
                )}
                {renderMensagem(msgNome)}
              </View>

              <InfoRow
                label="E-mail"
                value={usuario?.email || "Não informado"}
                colors={cores}
              />
              <InfoRow
                label="Identificação da conta"
                value={usuario?.id ? `#${usuario.id}` : "Não disponível"}
                colors={cores}
              />
              <InfoRow
                label="Tipo de conta"
                value={usuario?.tipo || "normal"}
                colors={cores}
                last
              />
            </View>

            {/* SEGURANÇA (biometria: só Android com biometria cadastrada) */}
            {Platform.OS === "android" && bioDisponivel && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>🔐</Text>
                  <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                    Segurança
                  </Text>
                  <View
                    style={[styles.sectionLine, { backgroundColor: cores.vermelho }]}
                  />
                </View>

                <View
                  style={[
                    styles.infoPanel,
                    { backgroundColor: cores.painel, borderColor: cores.borda },
                  ]}
                >
                  <View style={styles.infoRow}>
                    <View style={styles.infoRowHeader}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[styles.infoValue, { color: cores.texto }]}>
                          Entrar com biometria
                        </Text>
                        <Text
                          style={[
                            styles.infoLabel,
                            { color: cores.secundario, marginTop: 4 },
                          ]}
                        >
                          Use sua digital ou rosto para entrar no app sem digitar a
                          senha.
                        </Text>
                      </View>
                      <Switch
                        value={bioAtiva || pedindoSenhaBio}
                        onValueChange={alternarBiometria}
                        disabled={processandoBio}
                        trackColor={{ false: cores.borda, true: cores.laranja }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    {pedindoSenhaBio && (
                      <View style={{ gap: 10, marginTop: 8 }}>
                        <Text style={[styles.infoLabel, { color: cores.secundario }]}>
                          Confirme sua senha para ativar:
                        </Text>
                        <TextInput
                          value={senhaBio}
                          onChangeText={(t) => {
                            setSenhaBio(t);
                            setMsgBio(null);
                          }}
                          onSubmitEditing={confirmarAtivacaoBio}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!processandoBio}
                          placeholder="Sua senha"
                          placeholderTextColor={cores.secundario}
                          underlineColorAndroid="transparent"
                          style={[
                            styles.textInput,
                            {
                              backgroundColor: cores.campo,
                              borderColor: cores.borda,
                              color: cores.texto,
                            },
                          ]}
                        />
                        <View style={styles.inlineActions}>
                          <TouchableOpacity
                            onPress={confirmarAtivacaoBio}
                            disabled={processandoBio}
                            style={[
                              styles.smallPrimary,
                              {
                                backgroundColor: processandoBio
                                  ? "#626B7B"
                                  : cores.vermelho,
                              },
                            ]}
                          >
                            <Text style={styles.primaryButtonText}>
                              {processandoBio ? "Verificando..." : "Ativar"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={cancelarAtivacaoBio}
                            disabled={processandoBio}
                            style={[
                              styles.smallSecondary,
                              {
                                borderColor: cores.borda,
                                backgroundColor: cores.card,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.secondaryButtonText,
                                { color: cores.texto },
                              ]}
                            >
                              Cancelar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {renderMensagem(msgBio)}
                  </View>
                </View>
              </>
            )}

            {/* SALDO */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>💳</Text>
              <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                Saldo da conta
              </Text>
              <View
                style={[styles.sectionLine, { backgroundColor: cores.vermelho }]}
              />
            </View>

            <View
              style={[
                styles.balanceCard,
                { backgroundColor: cores.painel, borderColor: cores.borda },
              ]}
            >
              <Text style={[styles.balanceLabel, { color: cores.secundario }]}>
                Créditos disponíveis
              </Text>
              <Text style={[styles.balanceValue, { color: cores.laranja }]}>
                R$ {Number(usuario?.credito ?? 0).toFixed(2)}
              </Text>
              <Text style={[styles.balanceHint, { color: cores.secundario }]}>
                Seu saldo é atualizado com os dados do servidor.
              </Text>

              <View
                style={[styles.divider, { backgroundColor: cores.borda }]}
              />

              <Text style={[styles.balanceLabel, { color: cores.secundario }]}>
                Adicionar créditos
              </Text>

              <View style={styles.quickRow}>
                {VALORES_RAPIDOS.map((v) => {
                  const ativo = valorNumerico === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      disabled={adicionandoCredito}
                      onPress={() => {
                        setValorCredito(String(v));
                        setMsgCredito(null);
                      }}
                      style={[
                        styles.quickChip,
                        {
                          borderColor: ativo ? cores.laranja : cores.borda,
                          backgroundColor: ativo
                            ? isDark
                              ? "#17243B"
                              : "#FFF0E4"
                            : cores.campo,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          { color: ativo ? cores.laranja : cores.texto },
                        ]}
                      >
                        R$ {v}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View
                style={[
                  styles.moneyInputWrap,
                  { backgroundColor: cores.campo, borderColor: cores.borda },
                ]}
              >
                <Text style={[styles.moneyPrefix, { color: cores.secundario }]}>
                  R$
                </Text>
                <TextInput
                  value={valorCredito}
                  onChangeText={onChangeValorCredito}
                  onSubmitEditing={adicionarCreditos}
                  keyboardType="decimal-pad"
                  editable={!adicionandoCredito}
                  placeholder="Outro valor (ex.: 25,00)"
                  placeholderTextColor={cores.secundario}
                  underlineColorAndroid="transparent"
                  style={[styles.moneyInput, { color: cores.texto }]}
                />
              </View>

              {valorNumerico > 0 && (
                <Text style={[styles.balanceHint, { color: cores.secundario }]}>
                  Saldo após a recarga:{" "}
                  <Text style={{ color: cores.laranja, fontWeight: "800" }}>
                    R${" "}
                    {(Number(usuario?.credito ?? 0) + valorNumerico).toFixed(2)}
                  </Text>
                </Text>
              )}

              {renderMensagem(msgCredito)}

              <TouchableOpacity
                onPress={adicionarCreditos}
                disabled={!valorValido || adicionandoCredito}
                style={[
                  styles.addButton,
                  {
                    backgroundColor:
                      !valorValido || adicionandoCredito
                        ? "#626B7B"
                        : cores.vermelho,
                  },
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {adicionandoCredito ? "Processando..." : "Adicionar créditos"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={irInicio}
                style={[styles.primaryButton, { backgroundColor: cores.vermelho }]}
              >
                <Text style={styles.primaryButtonText}>Voltar ao início</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={carregarPerfil}
                disabled={carregando}
                style={[
                  styles.secondaryButton,
                  { borderColor: cores.borda, backgroundColor: cores.card },
                ]}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: cores.texto }]}
                >
                  {carregando ? "Atualizando..." : "Atualizar dados"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* MENU MOBILE */}
      <View
        pointerEvents={menuVisible ? "auto" : "none"}
        style={{
          display: menuVisible ? "flex" : "none",
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.65)",
        }}
      >
        <View
          style={[
            styles.mobileMenu,
            { backgroundColor: cores.painel, borderColor: cores.borda },
          ]}
        >
          <View style={styles.menuHeading}>
            <Text style={[styles.sectionTitle, { color: cores.texto }]}>Menu</Text>
            <TouchableOpacity onPress={() => setMenuVisible(false)}>
              <Image source={Fechar} style={{ width: 24, height: 24 }} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.menuLink, { borderColor: cores.borda }]}
            onPress={() => {
              setMenuVisible(false);
              irInicio();
            }}
          >
            <Text style={{ color: cores.texto }}>⌂   Início</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuLink, { borderColor: cores.borda }]}
            onPress={() => {
              setMenuVisible(false);
              irMeusLivros();
            }}
          >
            <Text style={{ color: cores.texto }}>▣   Meus Livros</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuLink, { borderColor: cores.laranja }]}
            onPress={() => setMenuVisible(false)}
          >
            <Text style={{ color: cores.laranja }}>👤   Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuLink, { borderColor: cores.borda }]}
            onPress={() => setTema((atual) => actualTema(atual))}
          >
            <Text style={{ color: cores.texto }}>
              {isDark ? "☀  Tema claro" : "☾  Tema escuro"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuLink, { borderColor: cores.vermelho }]}
            onPress={() => {
              setMenuVisible(false);
              logout();
            }}
          >
            <Text style={{ color: cores.vermelho }}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function actualTema(atual: "dark" | "light"): "dark" | "light" {
  return atual === "dark" ? "light" : "dark";
}

function InfoRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: { texto: string; secundario: string; borda: string };
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.borda },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.secundario }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.texto }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, flexDirection: "row" },
  sidebar: { width: 230, borderRightWidth: 1, paddingHorizontal: 12, paddingTop: 24, paddingBottom: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 34, gap: 8, marginTop: 4 },
  brandIcon: { width: 35, height: 35 },
  brandName: { fontSize: 19, fontWeight: "900", letterSpacing: 1.2 },
  navItem: { borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 4 },
  navLabel: { fontSize: 14, fontWeight: "600" },
  sidebarFooter: { marginTop: "auto", alignItems: "center", paddingVertical: 26 },
  sidebarBook: { fontSize: 68, marginBottom: 8 },
  sidebarMotto: { fontSize: 10, letterSpacing: 2, fontWeight: "700", marginTop: 3 },
  topbar: { minHeight: 68, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12 },
  greeting: { fontSize: 16, fontWeight: "800" },
  greetingSub: { fontSize: 11, marginTop: 2 },
  creditPill: { borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  creditLabel: { fontSize: 9 },
  creditValue: { fontSize: 13, fontWeight: "900" },
  themeButton: { borderWidth: 1, borderRadius: 22, width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerIconButton: { padding: 5 },
  headerIcon: { width: 26, height: 26, resizeMode: "contain" },
  logoutButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  logoutIcon: { width: 19, height: 19, resizeMode: "contain" },
  pageHeading: { borderWidth: 1, borderRadius: 18, padding: 22, flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 28 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 34, fontWeight: "900" },
  profileName: { fontSize: 23, fontWeight: "900" },
  profileEmail: { fontSize: 13, marginTop: 5 },
  accountBadge: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  accountBadgeText: { fontSize: 10, fontWeight: "900", textTransform: "capitalize" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 13, marginTop: 2 },
  sectionEmoji: { fontSize: 21 },
  sectionTitle: { fontSize: 16, fontWeight: "900" },
  sectionLine: { width: 34, height: 2, marginLeft: 2 },
  infoPanel: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, marginBottom: 26 },
  infoRow: { paddingVertical: 17, gap: 7 },
  infoRowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { fontSize: 11, fontWeight: "600" },
  infoValue: { fontSize: 14, fontWeight: "800" },
  editButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  editButtonText: { fontSize: 11, fontWeight: "800" },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, outlineStyle: "none" as any },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  smallPrimary: { minWidth: 110, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  smallSecondary: { minWidth: 110, borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  feedback: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  balanceCard: { borderWidth: 1, borderRadius: 16, padding: 22, marginBottom: 24 },
  balanceLabel: { fontSize: 12, fontWeight: "600" },
  balanceValue: { fontSize: 30, fontWeight: "900", marginTop: 8 },
  balanceHint: { fontSize: 11, marginTop: 8 },
  divider: { height: 1, marginVertical: 20 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 14 },
  quickChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 16 },
  quickChipText: { fontSize: 12, fontWeight: "800" },
  moneyInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  moneyPrefix: { fontSize: 14, fontWeight: "800", marginRight: 8 },
  moneyInput: { flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 14, outlineStyle: "none" as any },
  addButton: { borderRadius: 22, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", marginTop: 16 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  primaryButton: { minWidth: 160, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  secondaryButton: { minWidth: 160, borderWidth: 1, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center" },
  secondaryButtonText: { fontSize: 12, fontWeight: "800" },
  mobileMenu: { width: "85%", maxWidth: 360, height: "100%", borderRightWidth: 1, padding: 22, paddingTop: 56 },
  menuHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  menuLink: { padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
});