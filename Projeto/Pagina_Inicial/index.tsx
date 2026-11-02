import { useCallback, useEffect, useRef, useState } from "react";
import Paginarium_icon from "../assets/Paginarium_icon.png";

import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  TextInput,
  useWindowDimensions,
  Modal,
  FlatList,
  Platform,
  Alert,
} from "react-native";

import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePWAInstall } from "../hooks/usePWAInstall";

import Lua from "../assets/Lua_PixelArt.png";
import Sol from "../assets/Sol_PixelArt.png";
import Logout from "../assets/Logout.png";
import Opcoes_Clara from "../assets/Opcoes_Clara.png";
import Opcoes_Escura from "../assets/Opcoes_Escura.png";
import Fechar from "../assets/Fechar.png";
import Lupa from "../assets/Lupa.png";

// =====================================================
// API
// =====================================================

const BASE = "https://paginariumapi.onrender.com";

const ALUGUEL_PENDENTE_KEY = "aluguel_pendente";

// =====================================================
// RESOLVER URL DA CAPA
// =====================================================

function resolverCapaUrl(capaUrl?: string): string | undefined {
  if (!capaUrl) {
    return undefined;
  }

  if (capaUrl.startsWith("http://") || capaUrl.startsWith("https://")) {
    return capaUrl;
  }

  const caminho = capaUrl.startsWith("/") ? capaUrl : `/${capaUrl}`;

  return `${BASE}${caminho}`;
}

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

interface Livro {
  id: number;
  nome: string;
  genero: string;
  valor: number;
  capa_url?: string;
  pdf_url?: string;
  inserir_valor: number;
}

type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;

  Inicio: {
    usuario: Usuario;
    token: string;
  };

  LivrosAlugados: {
    usuario: Usuario;
    token: string;
  };

  Perfil: {
    usuario: Usuario;
    token: string;
  };
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

type InicioRouteProp = RouteProp<RootStackParamList, "Inicio">;

// =====================================================
// COMPONENTE
// =====================================================

export default function Inicio() {
  // ===================================================
  // DIMENSÃO
  // ===================================================

  const { width } = useWindowDimensions();

  const Mobile = width < 600;

  // ===================================================
  // NAVEGAÇÃO
  // ===================================================

  const navigation = useNavigation<NavigationProps>();

  const route = useRoute<InicioRouteProp>();

  // ===================================================
  // ESTADOS
  // ===================================================

  const [usuario, setUsuario] = useState<Usuario | undefined>(
    route.params?.usuario
  );

  const [token, setToken] = useState<string | null>(
    route.params?.token ?? null
  );

  const [tema, setTema] = useState<"dark" | "light">("dark");

  const [menuVisible, setMenuVisible] = useState(false);

  const [livros, setLivros] = useState<Livro[]>([]);

  const [busca, setBusca] = useState("");

  const [termoPesquisado, setTermoPesquisado] = useState("");

  const [carregando, setCarregando] = useState(false);

  const [livrosAlugadosIds, setLivrosAlugadosIds] = useState<Set<number>>(
    new Set()
  );

  const [livroSelecionado, setLivroSelecionado] = useState<Livro | null>(null);

  const [inserir_valor, setInserirValor] = useState("");

  // ===================================================
  // TEMA
  // ===================================================

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
      };

  // ===================================================
  // PWA
  // ===================================================

  const { isInstallable, install } = usePWAInstall();

  // ===================================================
  // NAVEGAÇÃO ENTRE TELAS
  // ===================================================

  function irMeusLivros() {
    if (usuario && token) {
      navigation.navigate("LivrosAlugados", { usuario, token });
    }
  }

  function irPerfil() {
    if (usuario && token) {
      navigation.navigate("Perfil", { usuario, token });
    }
  }

  // ===================================================
  // LOGOUT
  // ===================================================

  async function logout() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");

    navigation.navigate("Login");
  }

  // ===================================================
  // SESSÃO EXPIRADA
  // ===================================================

  async function handleUnauthorized() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");

    Alert.alert(
      "Sessão expirada",
      "Sua sessão expirou. Faça login novamente.",
      [
        {
          text: "OK",
          onPress: () => navigation.navigate("Login"),
        },
      ]
    );
  }

  // ===================================================
  // DATA DE HOJE
  // ===================================================

  function obterDataHoje() {
    const hoje = new Date();

    const ano = hoje.getFullYear();

    const mes = String(hoje.getMonth() + 1).padStart(2, "0");

    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }

  // ===================================================
  // FETCH SEM CACHE
  // ===================================================

  async function fetchSemCache(url: string, options: RequestInit = {}) {
    const separador = url.includes("?") ? "&" : "?";

    const urlAtualizada = `${url}${separador}_=${Date.now()}`;

    return fetch(urlAtualizada, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.headers || {}),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  }

  // ===================================================
  // CARREGAR USUÁRIO
  // ===================================================

  async function carregarUsuario(
    tkn: string,
    usuarioId: number
  ): Promise<Usuario | null> {
    try {
      const res = await fetchSemCache(`${BASE}/usuarios/${usuarioId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tkn}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized();
        return null;
      }

      if (!res.ok) {
        console.log("❌ Erro ao buscar usuário:", res.status);

        return null;
      }

      const usuarioServidor = await res.json();

      return {
        id: Number(usuarioServidor.id),
        nome: usuarioServidor.nome,
        email: usuarioServidor.email,
        credito: Number(usuarioServidor.credito),
        tipo: usuarioServidor.tipo ?? "normal",
      };
    } catch (erro) {
      console.log("❌ Erro ao carregar usuário:", erro);
      return null;
    }
  }

  // ===================================================
  // CARREGAR ALUGUÉIS ATIVOS
  // ===================================================

  async function carregarAlugueisAtivos(tkn: string) {
    try {
      const res = await fetchSemCache(`${BASE}/alugueis`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tkn}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        await handleUnauthorized();
        return;
      }

      if (!res.ok) {
        console.log("❌ Erro ao buscar aluguéis:", res.status);

        return;
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        return;
      }

      const hoje = obterDataHoje();

      const idsAtivos = new Set<number>(
        data
          .filter((aluguel: any) => {
            if (!aluguel.data_fim) {
              return false;
            }

            return String(aluguel.data_fim).substring(0, 10) >= hoje;
          })
          .map((aluguel: any) => Number(aluguel.livro_id))
      );

      setLivrosAlugadosIds(idsAtivos);
    } catch (erro) {
      console.log("❌ Erro ao carregar aluguéis:", erro);
    }
  }

  // ===================================================
  // CARREGAR LIVROS
  // ===================================================

  async function carregarLivros() {
    try {
      const res = await fetchSemCache(`${BASE}/livros`, {
        method: "GET",
      });

      if (!res.ok) {
        console.log("❌ Erro ao carregar livros:", res.status);

        return;
      }

      const data: Livro[] = await res.json();

      setLivros(
        data.map((livro) => ({
          ...livro,
          valor: Number(livro.valor),
        }))
      );
    } catch (erro) {
      console.log("❌ Erro ao carregar livros:", erro);
    }
  }

  // ===================================================
  // SINCRONIZAÇÃO
  // ===================================================

  const sincronizarDados = useCallback(
    async (tkn: string, usuarioAtual: Usuario) => {
      try {
        const usuarioServidor = await carregarUsuario(
          tkn,
          Number(usuarioAtual.id)
        );

        if (!usuarioServidor) {
          return;
        }

        const usuarioAtualizado: Usuario = {
          id: Number(usuarioServidor.id),
          nome: usuarioServidor.nome,
          email: usuarioServidor.email,
          credito: Number(usuarioServidor.credito),
          tipo: usuarioAtual.tipo ?? "normal",
        };

        setUsuario(usuarioAtualizado);

        await AsyncStorage.setItem(
          "usuario",
          JSON.stringify(usuarioAtualizado)
        );

        await carregarAlugueisAtivos(tkn);

        await carregarLivros();
      } catch (erro) {
        console.log("❌ Erro na sincronização:", erro);
      }
    },
    []
  );

  // ===================================================
  // RECUPERAR SESSÃO
  // ===================================================

  useEffect(() => {
    let cancelado = false;

    async function recuperarSessao() {
      try {
        const tokenSalvo = await AsyncStorage.getItem("token");

        const usuarioSalvo = await AsyncStorage.getItem("usuario");

        const tokenAtual = token ?? tokenSalvo;

        let usuarioAtual = usuario;

        if (!usuarioAtual && usuarioSalvo) {
          try {
            usuarioAtual = JSON.parse(usuarioSalvo);
          } catch (erro) {
            console.log("❌ Erro ao ler usuário:", erro);
          }
        }

        if (!tokenAtual) {
          navigation.navigate("Login");
          return;
        }

        if (!usuarioAtual?.id) {
          navigation.navigate("Login");
          return;
        }

        if (cancelado) {
          return;
        }

        setToken(tokenAtual);

        setUsuario(usuarioAtual);

        await sincronizarDados(tokenAtual, usuarioAtual);
      } catch (erro) {
        console.log("❌ Erro ao recuperar sessão:", erro);
      }
    }

    recuperarSessao();

    return () => {
      cancelado = true;
    };
  }, []);

  // ===================================================
  // LIVROS INICIALMENTE
  // ===================================================

  useEffect(() => {
    carregarLivros();
  }, []);

  // ===================================================
  // ALUGUÉIS QUANDO TOKEN EXISTIR
  // ===================================================

  useEffect(() => {
    if (token) {
      carregarAlugueisAtivos(token);
    }
  }, [token]);

  // ===================================================
  // SINCRONIZAÇÃO AO VOLTAR
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;

      async function atualizarAoVoltar() {
        try {
          const tokenSalvo = await AsyncStorage.getItem("token");

          const usuarioSalvo = await AsyncStorage.getItem("usuario");

          if (!tokenSalvo || !usuarioSalvo) {
            return;
          }

          if (cancelado) {
            return;
          }

          let usuarioStorage: Usuario;

          try {
            usuarioStorage = JSON.parse(usuarioSalvo);
          } catch (erro) {
            console.log("❌ Erro ao ler usuário:", erro);
            return;
          }

          if (!usuarioStorage?.id) {
            return;
          }

          // Retoma automaticamente um aluguel que tenha
          // ficado pendente por falta de internet.
          await processarAluguelPendente(tokenSalvo, false);

          await sincronizarDados(tokenSalvo, usuarioStorage);

          if (cancelado) {
            return;
          }

          setToken(tokenSalvo);
        } catch (erro) {
          console.log("❌ Erro ao sincronizar:", erro);
        }
      }

      atualizarAoVoltar();

      return () => {
        cancelado = true;
      };
    }, [sincronizarDados])
  );

  // ===================================================
  // FILTRO
  // ===================================================

  const livrosFiltrados = livros.filter((livro) => {
    if (!termoPesquisado.trim()) {
      return true;
    }

    const termo = termoPesquisado.toLowerCase();

    return (
      livro.nome.toLowerCase().includes(termo) ||
      livro.genero.toLowerCase().includes(termo)
    );
  });

  // ===================================================
  // PESQUISAR
  // ===================================================

  function pesquisar() {
    setTermoPesquisado(busca);
  }

  // ===================================================
  // CÁLCULO DO ALUGUEL
  // ===================================================

  const meses = parseInt(inserir_valor, 10);

  const totalAluguel =
    !isNaN(meses) && meses > 0 && livroSelecionado
      ? meses * Number(livroSelecionado.valor)
      : 0;

  const creditoAtual = Number(usuario?.credito ?? 0);

  const saldoInsuficiente = totalAluguel > creditoAtual;

  // ===================================================
  // ALUGUEL PENDENTE / OFFLINE FIRST
  // ===================================================

  const processandoAluguelPendente = useRef(false);

  async function salvarAluguelPendente(livroId: number, mesesAluguel: number) {
    await AsyncStorage.setItem(
      ALUGUEL_PENDENTE_KEY,
      JSON.stringify({
        livro_id: livroId,
        meses: mesesAluguel,
      })
    );
  }

  async function limparAluguelPendente() {
    await AsyncStorage.removeItem(ALUGUEL_PENDENTE_KEY);
  }

  async function finalizarAluguelConfirmado(
    tkn: string,
    data: any,
    mesesAluguel: number,
    mostrarSucesso: boolean = true
  ) {
    await limparAluguelPendente();

    setUsuario((usuarioAnterior) => {
      if (!usuarioAnterior) {
        return usuarioAnterior;
      }

      const atualizado: Usuario = {
        ...usuarioAnterior,
        credito: Number(data.novo_credito),
      };

      AsyncStorage.setItem("usuario", JSON.stringify(atualizado));

      return atualizado;
    });

    await carregarAlugueisAtivos(tkn);

    await carregarLivros();

    if (mostrarSucesso) {
      setLivroSelecionado(null);

      setInserirValor("");

      Alert.alert(
        "Sucesso!",
        `Livro alugado por ${mesesAluguel} ${
          mesesAluguel === 1 ? "mês" : "meses"
        }!`
      );
    }
  }

  async function processarAluguelPendente(
    tkn: string,
    mostrarSucesso: boolean = false
  ) {
    if (processandoAluguelPendente.current) {
      return;
    }

    const pendenteSalvo = await AsyncStorage.getItem(ALUGUEL_PENDENTE_KEY);

    if (!pendenteSalvo) {
      return;
    }

    let pendente: {
      livro_id: number;
      meses: number;
    };

    try {
      pendente = JSON.parse(pendenteSalvo);
    } catch (erro) {
      console.log("❌ Erro ao ler aluguel pendente:", erro);

      await limparAluguelPendente();

      return;
    }

    if (!pendente?.livro_id || !pendente?.meses || pendente.meses <= 0) {
      await limparAluguelPendente();
      return;
    }

    processandoAluguelPendente.current = true;

    setCarregando(true);

    try {
      while (true) {
        try {
          const res = await fetch(`${BASE}/alugueis`, {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tkn}`,
              "Cache-Control": "no-cache",
            },
            body: JSON.stringify({
              livro_id: pendente.livro_id,
              meses: pendente.meses,
            }),
          });

          if (res.status === 401 || res.status === 403) {
            await limparAluguelPendente();

            await handleUnauthorized();

            return;
          }

          const data = await res.json();

          if (res.ok) {
            await finalizarAluguelConfirmado(
              tkn,
              data,
              pendente.meses,
              mostrarSucesso
            );

            return;
          }

          // 409 pode acontecer se o servidor registrou o
          // aluguel antes de a resposta chegar ao aparelho.
          if (res.status === 409) {
            await limparAluguelPendente();

            const usuarioServidor = await carregarUsuario(
              tkn,
              Number(usuario?.id)
            );

            if (usuarioServidor) {
              setUsuario(usuarioServidor);

              await AsyncStorage.setItem(
                "usuario",
                JSON.stringify(usuarioServidor)
              );
            }

            await carregarAlugueisAtivos(tkn);

            await carregarLivros();

            if (mostrarSucesso) {
              setLivroSelecionado(null);

              setInserirValor("");

              Alert.alert(
                "Aluguel confirmado",
                "O livro já foi registrado para você."
              );
            }

            return;
          }

          // Erros definitivos, como saldo insuficiente,
          // não devem ficar tentando para sempre.
          await limparAluguelPendente();

          if (mostrarSucesso) {
            Alert.alert(
              "Erro",
              typeof data === "string" ? data : "Erro ao alugar"
            );
          }

          return;
        } catch (erro) {
          // Sem internet: mantém a pendência e continua
          // tentando até a conexão voltar.
          console.log("🌐 Sem conexão. Aluguel aguardando rede...", erro);

          await new Promise((resolver) => setTimeout(resolver, 3000));
        }
      }
    } finally {
      processandoAluguelPendente.current = false;

      setCarregando(false);
    }
  }

  // ===================================================
  // CONFIRMAR ALUGUEL
  // ===================================================

  async function confirmarAluguel() {
    if (
      !livroSelecionado ||
      isNaN(meses) ||
      meses <= 0 ||
      saldoInsuficiente
    ) {
      return;
    }

    if (!token) {
      await handleUnauthorized();
      return;
    }

    const livroId = livroSelecionado.id;

    const mesesAluguel = meses;

    // Salva antes de tentar a API. Se a internet cair ou
    // o aplicativo for fechado, a solicitação não é perdida.
    await salvarAluguelPendente(livroId, mesesAluguel);

    await processarAluguelPendente(token, true);
  }

  // ===================================================
  // INTERFACE — DASHBOARD PAGINARIUM
  // ===================================================

  const livroDestaque = livrosFiltrados[0] ?? livros[0];

  const renderCardLivro = ({ item }: { item: Livro }) => {
    const jaAlugado = livrosAlugadosIds.has(item.id);

    return (
      <View
        style={[
          styles.bookCard,
          {
            backgroundColor: cores.card,
            borderColor: cores.borda,
          },
        ]}
      >
        <Image
          source={
            item.capa_url ? { uri: resolverCapaUrl(item.capa_url) } : undefined
          }
          resizeMode="cover"
          style={styles.bookCover}
        />

        <View style={styles.bookInfo}>
          <Text
            numberOfLines={2}
            style={[styles.bookTitle, { color: cores.texto }]}
          >
            {item.nome}
          </Text>

          <Text
            numberOfLines={1}
            style={[styles.bookGenre, { color: cores.secundario }]}
          >
            {item.genero || "Literatura"}
          </Text>

          <Text style={[styles.bookPrice, { color: cores.laranja }]}>
            R$ {Number(item.valor).toFixed(2)} / mês
          </Text>

          <TouchableOpacity
            disabled={jaAlugado}
            onPress={() => {
              setInserirValor("");
              setLivroSelecionado(item);
            }}
            style={[
              styles.rentButton,
              {
                backgroundColor: jaAlugado ? "#596274" : cores.vermelho,
              },
            ]}
          >
            <Text style={styles.rentButtonText}>
              {jaAlugado ? "Já alugado" : "Alugar agora  ›"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: cores.fundo,
        }}
      >
        {/* MENU LATERAL */}
        {!Mobile && (
          <View
            style={[
              styles.sidebar,
              {
                backgroundColor: cores.painel,
                borderColor: cores.borda,
              },
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

            {[
              {
                label: "Início",
                action: () => {},
                active: true,
              },
              {
                label: "Meus Livros",
                action: irMeusLivros,
                active: false,
              },
              {
                label: "Perfil",
                action: irPerfil,
                active: false,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.navItem,
                  item.active && {
                    backgroundColor: isDark ? "#17243B" : "#EEF1F8",
                  },
                ]}
                onPress={item.action}
              >
                <Text
                  style={[
                    styles.navLabel,
                    {
                      color: item.active ? cores.laranja : cores.secundario,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

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

        {/* CONTEÚDO PRINCIPAL */}
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
            {Mobile ? (
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerIconButton}
              >
                <Image
                  source={isDark ? Opcoes_Clara : Opcoes_Escura}
                  style={styles.headerIcon}
                />
              </TouchableOpacity>
            ) : null}

            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: cores.texto }]}>
                Olá, {usuario?.nome ?? "Usuário"}
              </Text>

              <Text style={[styles.greetingSub, { color: cores.secundario }]}>
                Que bom ter você por aqui!
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
              onPress={() =>
                setTema((atual) => (atual === "dark" ? "light" : "dark"))
              }
              accessibilityRole="button"
              accessibilityLabel={
                isDark ? "Ativar tema claro" : "Ativar tema escuro"
              }
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
                <Text
                  style={{
                    color: cores.vermelho,
                    fontWeight: "700",
                  }}
                >
                  Sair
                </Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: Mobile ? 14 : 28,
              paddingTop: 18,
              paddingBottom: 34,
            }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* PESQUISA */}
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: cores.campo,
                  borderColor: cores.borda,
                },
              ]}
            >
              <Image
                source={Lupa}
                style={[styles.searchIcon, { tintColor: cores.secundario }]}
              />

              <TextInput
                value={busca}
                onChangeText={setBusca}
                onSubmitEditing={pesquisar}
                returnKeyType="search"
                placeholder="Digite o nome do livro ou gênero..."
                placeholderTextColor={cores.secundario}
                underlineColorAndroid="transparent"
                style={[styles.searchInput, { color: cores.texto }]}
              />

              <TouchableOpacity
                onPress={pesquisar}
                style={[styles.searchSubmit, { backgroundColor: cores.laranja }]}
              >
                <Image source={Lupa} style={styles.searchSubmitIcon} />
              </TouchableOpacity>
            </View>

            {/* DESTAQUE */}
            <View
              style={[
                styles.hero,
                {
                  borderColor: cores.borda,
                  backgroundColor: cores.painel,
                },
              ]}
            >
              {livroDestaque?.capa_url ? (
                <Image
                  source={{
                    uri: resolverCapaUrl(livroDestaque.capa_url),
                  }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              ) : null}

              <View
                style={[
                  styles.heroOverlay,
                  {
                    backgroundColor: isDark
                      ? "rgba(3,8,20,0.62)"
                      : "rgba(255,255,255,0.78)",
                  },
                ]}
              >
                <Text style={[styles.heroEyebrow, { color: cores.laranja }]}>
                  DESTAQUE  ━━━
                </Text>

                <Text
                  numberOfLines={2}
                  style={[styles.heroTitle, { color: cores.texto }]}
                >
                  {livroDestaque?.nome ?? "Descubra sua próxima leitura"}
                </Text>

                <Text
                  numberOfLines={2}
                  style={[styles.heroDescription, { color: cores.secundario }]}
                >
                  {livroDestaque
                    ? `${
                        livroDestaque.genero || "Uma grande história"
                      } esperando por você.`
                    : "Explore o catálogo e encontre uma nova história."}
                </Text>

                {livroDestaque && (
                  <TouchableOpacity
                    onPress={() => {
                      setInserirValor("");
                      setLivroSelecionado(livroDestaque);
                    }}
                    style={[styles.heroButton, { borderColor: cores.laranja }]}
                  >
                    <Text
                      style={[styles.heroButtonText, { color: cores.laranja }]}
                    >
                      VER DETALHES  ›
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* MAIS LIDOS / CATÁLOGO */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>🔥</Text>

              <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                {termoPesquisado ? "Resultados da pesquisa" : "Mais Lidos"}
              </Text>

              <View
                style={[styles.sectionLine, { backgroundColor: cores.vermelho }]}
              />

              <Text style={[styles.resultCount, { color: cores.laranja }]}>
                {livrosFiltrados.length} livros
              </Text>
            </View>

            {livrosFiltrados.length > 0 ? (
              <FlatList
                data={livrosFiltrados}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderCardLivro}
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{
                  paddingBottom: 8,
                  paddingRight: 8,
                }}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              />
            ) : (
              <View
                style={[
                  styles.emptyState,
                  {
                    borderColor: cores.borda,
                    backgroundColor: cores.painel,
                  },
                ]}
              >
                <Text
                  style={{
                    color: cores.texto,
                    textAlign: "center",
                  }}
                >
                  Nenhum livro encontrado para “{termoPesquisado}”.
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setBusca("");
                    setTermoPesquisado("");
                  }}
                  style={[
                    styles.heroButton,
                    {
                      borderColor: cores.laranja,
                      marginTop: 12,
                    },
                  ]}
                >
                  <Text
                    style={[styles.heroButtonText, { color: cores.laranja }]}
                  >
                    LIMPAR PESQUISA
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* RECOMENDADOS / ALUGUEL ATUAL */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionEmoji}>⭐</Text>

              <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                Recomendados para você
              </Text>

              <View
                style={[styles.sectionLine, { backgroundColor: cores.vermelho }]}
              />
            </View>

            <View
              style={[
                styles.recommendPanel,
                {
                  backgroundColor: cores.painel,
                  borderColor: cores.borda,
                },
              ]}
            >
              <View
                style={[styles.recommendCoverFrame, { borderColor: cores.borda }]}
              >
                {livroDestaque?.capa_url ? (
                  <Image
                    source={{
                      uri: resolverCapaUrl(livroDestaque.capa_url),
                    }}
                    style={styles.recommendCover}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 42 }}>📚</Text>
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={2}
                  style={[styles.recommendTitle, { color: cores.texto }]}
                >
                  {livroDestaque?.nome ?? "Seu próximo livro favorito"}
                </Text>

                <Text style={[styles.bookGenre, { color: cores.secundario }]}>
                  {livroDestaque?.genero ?? "Explore o catálogo do Paginarium"}
                </Text>

                {livroDestaque && (
                  <Text style={[styles.bookPrice, { color: cores.laranja }]}>
                    Valor: R$ {Number(livroDestaque.valor).toFixed(2)} / mês
                  </Text>
                )}

                {livroDestaque && (
                  <TouchableOpacity
                    onPress={() => {
                      setInserirValor("");
                      setLivroSelecionado(livroDestaque);
                    }}
                    style={[
                      styles.openPdfButton,
                      { backgroundColor: cores.vermelho },
                    ]}
                  >
                    <Text style={styles.rentButtonText}>Alugar livro</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* MODAL DE ALUGUEL */}
      <Modal
        visible={livroSelecionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !carregando && setLivroSelecionado(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: cores.painel,
                borderColor: cores.borda,
              },
            ]}
          >
            <TouchableOpacity
              disabled={carregando}
              onPress={() => setLivroSelecionado(null)}
              style={styles.modalClose}
            >
              <Image source={Fechar} style={{ width: 22, height: 22 }} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: cores.texto }]}>
              {livroSelecionado?.nome}
            </Text>

            <TextInput
              placeholder="Por quantos meses deseja alugar?"
              placeholderTextColor={cores.secundario}
              value={inserir_valor}
              onChangeText={(text) =>
                setInserirValor(
                  text
                    .replace(/[^0-9]/g, "")
                    .replace(/^0+/, "")
                    .slice(0, 4)
                )
              }
              keyboardType="numeric"
              maxLength={4}
              style={[
                styles.monthInput,
                {
                  backgroundColor: cores.campo,
                  borderColor: cores.borda,
                  color: cores.texto,
                },
              ]}
            />

            {inserir_valor !== "" &&
              livroSelecionado &&
              !isNaN(meses) &&
              meses > 0 && (
                <Text
                  style={[styles.calculationText, { color: cores.secundario }]}
                >
                  {meses} {meses === 1 ? "mês" : "meses"} × R${" "}
                  {Number(livroSelecionado.valor).toFixed(2)} ={" "}
                  <Text
                    style={{
                      color: saldoInsuficiente ? cores.vermelho : cores.laranja,
                      fontWeight: "800",
                    }}
                  >
                    R$ {totalAluguel.toFixed(2)}
                  </Text>
                </Text>
              )}

            {saldoInsuficiente && inserir_valor !== "" && meses > 0 && (
              <Text style={[styles.balanceMessage, { color: cores.vermelho }]}>
                Saldo insuficiente. Você possui R$ {creditoAtual.toFixed(2)} de
                crédito.
              </Text>
            )}

            {!saldoInsuficiente && inserir_valor !== "" && meses > 0 && (
              <Text style={[styles.balanceMessage, { color: "#25A66A" }]}>
                Saldo após aluguel: R${" "}
                {(creditoAtual - totalAluguel).toFixed(2)}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                {
                  backgroundColor:
                    saldoInsuficiente ||
                    !inserir_valor ||
                    isNaN(meses) ||
                    meses <= 0 ||
                    carregando
                      ? "#626B7B"
                      : cores.vermelho,
                },
              ]}
              disabled={
                saldoInsuficiente ||
                !inserir_valor ||
                isNaN(meses) ||
                meses <= 0 ||
                carregando
              }
              onPress={confirmarAluguel}
            >
              <Text style={styles.rentButtonText}>
                {carregando ? "Processando..." : "Confirmar aluguel"}
              </Text>
            </TouchableOpacity>

            {carregando && (
              <Text style={[styles.processingText, { color: cores.secundario }]}>
                Se a conexão cair, a solicitação continuará aguardando a
                internet.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* MENU MOBILE */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuBackdrop}>
          <View
            style={[
              styles.mobileMenu,
              {
                backgroundColor: cores.painel,
                borderColor: cores.borda,
              },
            ]}
          >
            <View style={styles.menuHeading}>
              <Text style={[styles.sectionTitle, { color: cores.texto }]}>
                Menu
              </Text>

              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Image source={Fechar} style={{ width: 24, height: 24 }} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.menuLink, { borderColor: cores.laranja }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={{ color: cores.laranja }}>⌂   Início</Text>
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
              style={[styles.menuLink, { borderColor: cores.borda }]}
              onPress={() => {
                setMenuVisible(false);
                irPerfil();
              }}
            >
              <Text style={{ color: cores.texto }}>👤   Perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuLink, { borderColor: cores.borda }]}
              onPress={() =>
                setTema((atual) => (atual === "dark" ? "light" : "dark"))
              }
            >
              <Text style={{ color: cores.texto }}>
                {isDark ? "☀  Tema claro" : "☾  Tema escuro"}
              </Text>
            </TouchableOpacity>

            {isInstallable && (
              <TouchableOpacity
                style={[styles.menuLink, { borderColor: cores.borda }]}
                onPress={() => {
                  setMenuVisible(false);
                  install();
                }}
              >
                <Text style={{ color: cores.texto }}>
                  ⇩   Instalar aplicativo
                </Text>
              </TouchableOpacity>
            )}

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
      </Modal>
    </KeyboardAvoidingView>
  );
}

// =====================================================
// ESTILOS — DASHBOARD PAGINARIUM
// =====================================================

const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 18,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
    gap: 8,
    marginTop: 4,
  },

  // Imagem do logotipo Paginarium
  brandIcon: {
    width: 35,
    height: 35,
  },

  brandName: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  activeNav: {
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  navItem: {
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 4,
  },

  navLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  sidebarFooter: {
    marginTop: "auto",
    alignItems: "center",
    paddingVertical: 26,
  },

  sidebarBook: {
    fontSize: 68,
    marginBottom: 8,
  },

  sidebarMotto: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 3,
  },

  topbar: {
    minHeight: 68,
    borderBottomWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 12,
  },

  greeting: {
    fontSize: 16,
    fontWeight: "800",
  },

  greetingSub: {
    fontSize: 11,
    marginTop: 2,
  },

  creditPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  creditLabel: {
    fontSize: 9,
  },

  creditValue: {
    fontSize: 13,
    fontWeight: "900",
  },

  themeButton: {
    borderWidth: 1,
    borderRadius: 22,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerIconButton: {
    padding: 5,
  },

  headerIcon: {
    width: 26,
    height: 26,
    resizeMode: "contain",
  },

  logoutButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  logoutIcon: {
    width: 19,
    height: 19,
    resizeMode: "contain",
  },

  searchBar: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    overflow: "hidden",
    marginBottom: 18,
  },

  searchIcon: {
    width: 21,
    height: 21,
    resizeMode: "contain",
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    outlineStyle: "none" as any,
  },

  searchSubmit: {
    width: 52,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    margin: 2,
  },

  searchSubmitIcon: {
    width: 25,
    height: 25,
    resizeMode: "contain",
    tintColor: "#10101C",
  },

  hero: {
    height: 205,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 22,
    justifyContent: "center",
  },

  // Preenchimento da área do destaque sem absoluteFillObject
  heroImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },

  heroOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 18,
  },

  heroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  heroTitle: {
    fontSize: 27,
    fontWeight: "900",
    maxWidth: 520,
    lineHeight: 30,
  },

  heroDescription: {
    fontSize: 12,
    marginTop: 7,
    maxWidth: 400,
  },

  heroButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },

  heroButtonText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },

  sectionEmoji: {
    fontSize: 21,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
  },

  sectionLine: {
    width: 34,
    height: 2,
    marginLeft: 2,
  },

  resultCount: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "700",
  },

  bookCard: {
    width: 190,
    borderWidth: 1,
    borderRadius: 13,
    padding: 9,
    overflow: "hidden",
  },

  bookCover: {
    width: "100%",
    height: 124,
    borderRadius: 8,
    backgroundColor: "#17243B",
  },

  bookInfo: {
    paddingTop: 8,
  },

  bookTitle: {
    fontSize: 12,
    fontWeight: "800",
    minHeight: 31,
  },

  bookGenre: {
    fontSize: 10,
    marginTop: 4,
  },

  bookPrice: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },

  rentButton: {
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    marginTop: 10,
  },

  rentButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
    alignItems: "center",
  },

  recommendPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },

  recommendCoverFrame: {
    width: 116,
    height: 152,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  recommendCover: {
    width: "100%",
    height: "100%",
  },

  recommendTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 5,
  },

  openPdfButton: {
    alignSelf: "flex-start",
    minWidth: 170,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    paddingTop: 30,
  },

  modalClose: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 18,
  },

  monthInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    textAlign: "center",
    marginBottom: 14,
  },

  calculationText: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 13,
  },

  balanceMessage: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 14,
  },

  confirmButton: {
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginTop: 4,
  },

  processingText: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 12,
  },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-start",
  },

  mobileMenu: {
    width: "85%",
    maxWidth: 360,
    height: "100%",
    borderRightWidth: 1,
    padding: 22,
    paddingTop: 56,
  },

  menuHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  menuLink: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
});