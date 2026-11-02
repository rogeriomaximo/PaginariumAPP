
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

// const BASE = "http://10.0.10.209:8080";
const BASE = "https://paginariumapi.onrender.com";

interface Aluguel {
  id: number;
  livro_id: number;
  nome: string;
  capa_url: string;
  pdf_url: string;
  meses: number;
  valor_total: string;
  data_inicio: string;
  data_fim: string;
  criado_em: string;
  segundos_restantes: number;
}

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
  Inicio: {
    usuario: Usuario;
    token: string;
  };
  Inicio_Adm: undefined;
  LivrosAlugados: {
    usuario: Usuario;
    token: string;
  };
  Perfil: {
    usuario: Usuario;
    token: string;
  };
};

type NavigationProps =
  NativeStackNavigationProp<RootStackParamList>;

type RouteProps =
  RouteProp<RootStackParamList, "LivrosAlugados">;

export default function LivrosAlugados() {
  const { width } = useWindowDimensions();
  const Mobile = width < 600;

  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  const { usuario, token: tokenParam } = route.params;

  const [token, setToken] = useState<string>(tokenParam ?? "");
  const [alugueis, setAlugueis] = useState<Aluguel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [contagensLocais, setContagensLocais] =
    useState<Record<number, number>>({});
  const [processando, setProcessando] = useState<number | null>(null);

  // Estado do leitor de PDF.
  const [pdfVisivel, setPdfVisivel] = useState(false);
  const [pdfSelecionado, setPdfSelecionado] = useState("");
  const [nomePdf, setNomePdf] = useState("");

  // Recupera o token caso não tenha sido passado pela navegação.
  useEffect(() => {
    async function garantirToken() {
      if (!tokenParam) {
        try {
          const salvo = await AsyncStorage.getItem("token");

          if (salvo) {
            setToken(salvo);
          } else {
            setCarregando(false);
          }
        } catch (err) {
          console.error("Erro ao recuperar token:", err);
          setCarregando(false);
        }
      }
    }

    garantirToken();
  }, [tokenParam]);

  // Carrega os aluguéis.
  const carregar = useCallback(async (tkn: string) => {
    if (!tkn) {
      setCarregando(false);
      return;
    }

    setCarregando(true);

    try {
      const res = await fetch(`${BASE}/alugueis`, {
        headers: {
          Authorization: `Bearer ${tkn}`,
        },
      });

      // Token vencido: limpa a sessão e volta para o login
      if (res.status === 401 || res.status === 403) {
        await AsyncStorage.multiRemove(["token", "usuario"]);
        navigation.navigate("Login");
        return;
      }

      if (!res.ok) {
        throw new Error("Não foi possível carregar os aluguéis.");
      }

      const data: Aluguel[] = await res.json();
      const lista = Array.isArray(data) ? data : [];

      setAlugueis(lista);

      const iniciais: Record<number, number> = {};

      lista.forEach((aluguel) => {
        iniciais[aluguel.id] = Math.max(
          0,
          Number(aluguel.segundos_restantes) || 0
        );
      });

      setContagensLocais(iniciais);
    } catch (err) {
      console.error("Erro ao carregar aluguéis:", err);

      Alert.alert(
        "Erro",
        "Não foi possível carregar seus livros. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      carregar(token);
    }, [token, carregar])
  );

  // Atualiza a contagem regressiva a cada segundo.
  useEffect(() => {
    const intervalo = setInterval(() => {
      setContagensLocais((prev) => {
        const atualizado: Record<number, number> = {};

        for (const id in prev) {
          atualizado[Number(id)] = Math.max(
            0,
            prev[Number(id)] - 1
          );
        }

        return atualizado;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  function formatarData(dataStr: string): string {
    const data = new Date(dataStr);

    if (Number.isNaN(data.getTime())) {
      return dataStr;
    }

    return data.toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
  }

  function estaAtivo(dataFim: string): boolean {
    const data = new Date(dataFim).getTime();
    return !Number.isNaN(data) && data >= Date.now();
  }

  function formatarContagem(segundos: number): string {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;

    return `${min}:${seg.toString().padStart(2, "0")}`;
  }

  function formatarMoeda(valor: string | number): string {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  // Abre o PDF dentro do modal.
  function abrirPdf(url: string, nome: string) {
    if (!url) {
      Alert.alert(
        "PDF indisponível",
        "O arquivo deste livro não possui um endereço válido."
      );
      return;
    }

    setPdfSelecionado(url);
    setNomePdf(nome);
    setPdfVisivel(true);
  }

  // Fecha o modal.
  function fecharPdf() {
    setPdfVisivel(false);
    setPdfSelecionado("");
    setNomePdf("");
  }

  // Realiza o reembolso.
  async function executarReembolso(aluguel: Aluguel) {
    if (processando !== null) {
      return;
    }

    setProcessando(aluguel.id);

    try {
      const res = await fetch(`${BASE}/alugueis/${aluguel.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert(
          "Erro",
          typeof data === "string"
            ? data
            : data?.detail ?? "Não foi possível realizar o reembolso."
        );
        return;
      }

      // Atualiza o saldo salvo no dispositivo.
      if (data.novo_credito !== undefined) {
        const usuarioSalvo = await AsyncStorage.getItem("usuario");

        if (usuarioSalvo) {
          const usuarioAtualizado = {
            ...JSON.parse(usuarioSalvo),
            credito: data.novo_credito,
          };

          await AsyncStorage.setItem(
            "usuario",
            JSON.stringify(usuarioAtualizado)
          );
        }
      }

      setAlugueis((prev) =>
        prev.filter((item) => item.id !== aluguel.id)
      );

      setContagensLocais((prev) => {
        const copia = { ...prev };
        delete copia[aluguel.id];
        return copia;
      });

      Alert.alert(
        "Reembolso realizado!",
        `${formatarMoeda(aluguel.valor_total)} devolvidos ao seu saldo.`
      );
    } catch (err) {
      console.error("Erro ao realizar reembolso:", err);

      Alert.alert(
        "Erro",
        "Não foi possível conectar ao servidor."
      );
    } finally {
      setProcessando(null);
    }
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right"]}
    >
      {/* CABEÇALHO */}
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.botaoVoltar}
          accessibilityLabel="Voltar"
          activeOpacity={0.7}
        >
          <Text style={styles.setaVoltar}>←</Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.tituloHeader,
            Mobile && styles.tituloHeaderMobile,
          ]}
        >
          Meus Livros
        </Text>

        <View style={styles.espacadorHeader} />
      </View>

      {/* CARREGAMENTO */}
      {carregando ? (
        <View style={styles.estadoCentralizado}>
          <ActivityIndicator size="large" color="#ff263f" />

          <Text style={styles.textoCarregando}>
            Carregando seus livros...
          </Text>
        </View>
      ) : alugueis.length === 0 ? (
        /* ESTADO VAZIO */
        <View style={styles.estadoCentralizado}>
          <Text style={styles.iconeVazio}>📚</Text>

          <Text style={styles.tituloVazio}>
            Você ainda não alugou nenhum livro.
          </Text>

          <Text style={styles.descricaoVazio}>
            Seus livros alugados aparecerão aqui.
          </Text>
        </View>
      ) : (
        /* LISTA DE LIVROS */
        <FlatList
          data={alugueis}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.lista,
            Mobile && styles.listaMobile,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const ativo = estaAtivo(item.data_fim);

            const segundosRestantes =
              contagensLocais[item.id] ?? 0;

            const podeReembolsar = segundosRestantes > 0;
            const estaProcessando = processando === item.id;

            return (
              <View
                style={[
                  styles.card,
                  {
                    width: Mobile
                      ? "100%"
                      : Math.min(width - 40, 600),
                  },
                ]}
              >
                {/* CAPA */}
                {item.capa_url ? (
                  <Image
                    source={{ uri: item.capa_url }}
                    style={[
                      styles.capa,
                      Mobile && styles.capaMobile,
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.capa,
                      styles.capaSemImagem,
                      Mobile && styles.capaMobile,
                    ]}
                  >
                    <Text style={styles.capaSemImagemTexto}>
                      📚
                    </Text>
                  </View>
                )}

                {/* INFORMAÇÕES DO ALUGUEL */}
                <View style={styles.conteudoLivro}>
                  <Text
                    style={styles.tituloLivro}
                    numberOfLines={2}
                  >
                    {item.nome}
                  </Text>

                  <Text style={styles.info}>
                    {item.meses}{" "}
                    {item.meses === 1 ? "mês" : "meses"} alugado
                  </Text>

                  <Text style={styles.info}>
                    Valor pago: {formatarMoeda(item.valor_total)}
                  </Text>

                  <Text style={styles.info}>
                    Início: {formatarData(item.data_inicio)}
                  </Text>

                  <Text
                    style={[
                      styles.validade,
                      !ativo && styles.validadeExpirada,
                    ]}
                  >
                    {ativo
                      ? `Válido até: ${formatarData(item.data_fim)}`
                      : `Expirado em: ${formatarData(item.data_fim)}`}
                  </Text>

                  {/* STATUS */}
                  <View
                    style={[
                      styles.badgeStatus,
                      ativo
                        ? styles.statusAtivo
                        : styles.statusExpirado,
                    ]}
                  >
                    <Text
                      style={[
                        styles.textoStatus,
                        ativo
                          ? styles.textoAtivo
                          : styles.textoExpirado,
                      ]}
                    >
                      {ativo ? "● Ativo" : "● Expirado"}
                    </Text>
                  </View>

                  {/* AÇÕES */}
                  <View style={styles.acoes}>
                    <TouchableOpacity
                      style={[
                        styles.btnPdf,
                        !ativo && styles.btnPdfDesativado,
                      ]}
                      onPress={() =>
                        abrirPdf(item.pdf_url, item.nome)
                      }
                      disabled={!ativo}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.textoBtnPdf}>
                        Abrir PDF
                      </Text>
                    </TouchableOpacity>

                    {podeReembolsar ? (
                      <TouchableOpacity
                        style={[
                          styles.btnReembolso,
                          estaProcessando && styles.btnProcessando,
                        ]}
                        disabled={estaProcessando}
                        onPress={() => executarReembolso(item)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.textoBtnReembolso}>
                          {estaProcessando
                            ? "Processando..."
                            : `Reembolsar (${formatarContagem(
                                segundosRestantes
                              )})`}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.btnReembolsoExpirado}>
                        <Text style={styles.textoReembolsoExpirado}>
                          Prazo de reembolso encerrado
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* MODAL DO LEITOR DE PDF */}
      <Modal
        visible={pdfVisivel}
        animationType="fade"
        transparent={false}
        onRequestClose={fecharPdf}
        presentationStyle="fullScreen"
      >
        <SafeAreaView
          style={styles.pdfModal}
          edges={["top", "bottom", "left", "right"]}
        >
          {/* CABEÇALHO DO LEITOR */}
          <View style={styles.pdfHeader}>
            <View style={styles.pdfHeaderInfo}>
              <Text
                style={styles.pdfTitulo}
                numberOfLines={1}
              >
                {nomePdf}
              </Text>

              <Text style={styles.pdfSubtitulo}>
                Leitor de livros
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pdfBotaoFechar}
              onPress={fecharPdf}
              activeOpacity={0.8}
              accessibilityLabel="Fechar leitor de PDF"
            >
              <Text style={styles.pdfTextoFechar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ÁREA DO PDF */}
          <View style={styles.pdfConteudo}>
            {pdfVisivel && pdfSelecionado ? (
              Platform.OS === "web" ? (
                <iframe
                  key={pdfSelecionado}
                  src={`${pdfSelecionado}#toolbar=0&navpanes=0&scrollbar=1`}
                  title={nomePdf || "Leitor de PDF"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "#ffffff",
                  }}
                />
              ) : (
                <View style={styles.pdfAlternativa}>
                  <Text style={styles.pdfMensagem}>
                    Para visualizar este livro, abra o arquivo no
                    leitor de PDF do dispositivo.
                  </Text>

                  <TouchableOpacity
                    style={styles.pdfBotaoAbrir}
                    onPress={() => {
                      Linking.openURL(pdfSelecionado).catch(() => {
                        Alert.alert(
                          "Erro",
                          "Não foi possível abrir o PDF."
                        );
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pdfBotaoAbrirTexto}>
                      Abrir PDF
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.estadoCentralizado}>
                <ActivityIndicator
                  size="large"
                  color="#ff263f"
                />
              </View>
            )}
          </View>

          {/* RODAPÉ DO LEITOR */}
          <View style={styles.pdfFooter}>
            <Text style={styles.pdfFooterTexto}>
              Utilize os controles do leitor para ampliar e navegar
              pelas páginas.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // FUNDO GERAL
  container: {
    flex: 1,
    backgroundColor: "#050914",
  },

  // CABEÇALHO
  navbar: {
    width: "100%",
    height: 86,
    backgroundColor: "#0b1222",
    borderBottomWidth: 1,
    borderBottomColor: "#ff263f",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  botaoVoltar: {
    width: 42,
    height: 46,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  setaVoltar: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "400",
  },

  tituloHeader: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  tituloHeaderMobile: {
    fontSize: 16,
  },

  espacadorHeader: {
    width: 42,
  },

  // LISTA DE LIVROS
  lista: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },

  listaMobile: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },

  // CARTÃO DO ALUGUEL
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0b1426",
    borderWidth: 1,
    borderColor: "#243653",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 14,
  },

  // CAPA
  capa: {
    width: 85,
    height: 128,
    borderRadius: 7,
    backgroundColor: "#111c30",
  },

  capaMobile: {
    width: 76,
    height: 114,
  },

  capaSemImagem: {
    alignItems: "center",
    justifyContent: "center",
  },

  capaSemImagemTexto: {
    fontSize: 28,
  },

  // INFORMAÇÕES DO LIVRO
  conteudoLivro: {
    flex: 1,
    minWidth: 0,
  },

  tituloLivro: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7,
  },

  info: {
    color: "#aab6cd",
    fontSize: 11,
    marginBottom: 5,
  },

  validade: {
    color: "#ff7043",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 7,
  },

  validadeExpirada: {
    color: "#7f8ba3",
  },

  // STATUS
  badgeStatus: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },

  statusAtivo: {
    backgroundColor: "#143326",
  },

  statusExpirado: {
    backgroundColor: "#182337",
  },

  textoStatus: {
    fontSize: 10,
    fontWeight: "700",
  },

  textoAtivo: {
    color: "#6ee7a0",
  },

  textoExpirado: {
    color: "#8d9ab0",
  },

  // AÇÕES
  acoes: {
    width: "100%",
    gap: 6,
  },

  btnPdf: {
    minHeight: 35,
    backgroundColor: "#ff5108",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
  },

  btnPdfDesativado: {
    backgroundColor: "#39445a",
  },

  textoBtnPdf: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  btnReembolso: {
    minHeight: 34,
    backgroundColor: "#172944",
    borderWidth: 1,
    borderColor: "#30496b",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 9,
  },

  btnProcessando: {
    backgroundColor: "#39445a",
  },

  textoBtnReembolso: {
    color: "#d8e5ff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  btnReembolsoExpirado: {
    minHeight: 34,
    backgroundColor: "#111a2a",
    borderWidth: 1,
    borderColor: "#29364b",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },

  textoReembolsoExpirado: {
    color: "#7f8ba3",
    fontSize: 10,
    textAlign: "center",
  },

  // CARREGAMENTO E LISTA VAZIA
  estadoCentralizado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  textoCarregando: {
    color: "#aab6cd",
    fontSize: 13,
    marginTop: 12,
  },

  iconeVazio: {
    fontSize: 42,
    marginBottom: 12,
  },

  tituloVazio: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },

  descricaoVazio: {
    color: "#aab6cd",
    fontSize: 13,
    textAlign: "center",
  },

  // MODAL DO LEITOR
  pdfModal: {
    flex: 1,
    backgroundColor: "#050914",
  },

  pdfHeader: {
    minHeight: 68,
    backgroundColor: "#0b1222",
    borderBottomWidth: 1,
    borderBottomColor: "#ff263f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },

  pdfHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },

  pdfTitulo: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  pdfSubtitulo: {
    color: "#aab6cd",
    fontSize: 11,
    marginTop: 4,
  },

  pdfBotaoFechar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff263f",
    alignItems: "center",
    justifyContent: "center",
  },

  pdfTextoFechar: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },

  pdfConteudo: {
    flex: 1,
    backgroundColor: "#202633",
    overflow: "hidden",
  },

  pdfFooter: {
    minHeight: 38,
    backgroundColor: "#0b1222",
    borderTopWidth: 1,
    borderTopColor: "#243653",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  pdfFooterTexto: {
    color: "#aab6cd",
    fontSize: 11,
    textAlign: "center",
  },

  pdfAlternativa: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },

  pdfMensagem: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
  },

  pdfBotaoAbrir: {
    backgroundColor: "#ff263f",
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },

  pdfBotaoAbrirTexto: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
