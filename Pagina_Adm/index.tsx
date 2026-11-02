import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  TextInput,
  useWindowDimensions,
} from "react-native";

import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import Lua from "../assets/Lua_PixelArt.png";
import Sol from "../assets/Sol_PixelArt.png";
import Logout from "../assets/Logout.png";

const API = "https://paginariumapi.onrender.com";

// Cabeçalho com o token do administrador (necessário para criar, editar e remover livros).
async function cabecalhoAuth(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A API responde com texto JSON ("mensagem") ou { erro: "..." }.
function mensagemDe(texto: string, status: number): string {
  try {
    const d = JSON.parse(texto);
    if (typeof d === "string" && d.trim()) return d;
    const msg = d?.erro ?? d?.mensagem ?? d?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch {
    // resposta não era JSON
  }
  return `A API retornou o status ${status}.`;
}

// Anexa um arquivo ao FormData. Na web é preciso enviar um Blob de verdade;
// no celular o React Native aceita { uri, name, type }.
async function anexarArquivo(
  formData: FormData,
  campo: string,
  arquivo: { uri: string; name?: string; type?: string },
  nomePadrao: string,
  tipoPadrao: string
) {
  const nome = arquivo.name ?? nomePadrao;
  const tipo = arquivo.type ?? tipoPadrao;

  if (Platform.OS === "web") {
    const blob = await (await fetch(arquivo.uri)).blob();
    formData.append(campo, new Blob([blob], { type: tipo || blob.type }), nome);
    return;
  }

  formData.append(campo, { uri: arquivo.uri, name: nome, type: tipo } as any);
}

interface Usuario {
  nome: string;
}

interface Livro {
  id: number;
  nome: string;
  genero: string;
  capa_url?: string;
  pdf_url?: string;
  valor: number;
}

type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  Inicio_Adm: {
    usuario?: Usuario;
    token?: string;
  };
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;
type InicioRouteProp = RouteProp<RootStackParamList, "Inicio_Adm">;

export default function Inicio_Adm() {
  const { width } = useWindowDimensions();

  const Mobile = width < 600;
  const colunas = 1;

  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<InicioRouteProp>();

  const [usuario, setUsuario] = useState<Usuario | null>(
    route.params?.usuario ?? null
  );

  const [tema, setTema] = useState("#e9eaecde");
  const [modal, setModal] = useState(false);

  const [livros, setLivros] = useState<Livro[]>([]);

  const [nome, setNome] = useState("");
  const [genero, setGenero] = useState("");
  const [valor, setValor] = useState("");

  const [capa, setCapa] = useState<any>(null);
  const [pdf, setPdf] = useState<any>(null);

  const [editId, setEditId] = useState<number | null>(null);

  // Recuperar usuário salvo
  useEffect(() => {
    async function recuperarUsuario() {
      try {
        const salvo = await AsyncStorage.getItem("usuario");

        if (salvo) {
          const usuarioSalvo = JSON.parse(salvo);
          setUsuario(usuarioSalvo);
        }
      } catch (erro) {
        console.log("ERRO AO RECUPERAR USUÁRIO:", erro);
      }
    }

    recuperarUsuario();
  }, []);

  // Sair: limpa a sessão salva (senão o app reabre direto no painel do admin)
  async function sair() {
    await AsyncStorage.multiRemove(["token", "usuario"]);
    navigation.navigate("Login");
  }

  // Tema
  function Tema_Escuro() {
    setTema("black");
  }

  function Tema_Claro() {
    setTema("#e9eaecde");
  }

  // Carregar livros
  async function carregarLivros() {
    try {
      const res = await fetch(`${API}/livros`, {
        method: "GET",
        cache: "no-store",
      });

      console.log("STATUS /livros:", res.status);

      if (!res.ok) {
        const texto = await res.text();
        console.log("ERRO AO BUSCAR LIVROS:", texto);

        Alert.alert(
          "Erro",
          `Não foi possível carregar os livros. Código HTTP: ${res.status}.`
        );
        return;
      }

      const data: Livro[] = await res.json();

      setLivros(data);
    } catch (err) {
      console.log("ERRO AO CARREGAR LIVROS:", err);

      Alert.alert(
        "Erro de conexão",
        "Não foi possível carregar os livros. Verifique sua conexão."
      );
    }
  }

  useEffect(() => {
    carregarLivros();
  }, []);

  // Selecionar capa
  async function selecionarCapa() {
    try {
      const permissao =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à galeria para selecionar a capa."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];

        const nomeArquivo =
          asset.fileName ??
          asset.uri.split("/").pop() ??
          "capa.jpg";

        const isPng = nomeArquivo.toLowerCase().endsWith(".png");

        setCapa({
          uri: asset.uri,
          name: nomeArquivo,
          type: asset.mimeType ?? (isPng ? "image/png" : "image/jpeg"),
        });
      }
    } catch (erro) {
      console.log("ERRO AO SELECIONAR CAPA:", erro);
      Alert.alert("Erro", "Não foi possível selecionar a capa.");
    }
  }

  // Selecionar PDF
  async function selecionarPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];

        setPdf({
          uri: asset.uri,
          name: asset.name ?? "livro.pdf",
          type: asset.mimeType ?? "application/pdf",
        });
      }
    } catch (erro) {
      console.log("ERRO AO SELECIONAR PDF:", erro);
      Alert.alert("Erro", "Não foi possível selecionar o PDF.");
    }
  }

  // Salvar ou editar livro
  async function salvarLivro() {
    const valorNumerico = Number(valor.trim().replace(",", "."));

    if (
      !nome.trim() ||
      !genero.trim() ||
      valor.trim() === "" ||
      !Number.isFinite(valorNumerico) ||
      valorNumerico < 0
    ) {
      Alert.alert(
        "Dados incompletos",
        "Preencha nome, gênero e um valor válido para o livro."
      );
      return;
    }

    try {
      const formData = new FormData();

      formData.append("nome", nome.trim());
      formData.append("genero", genero.trim());
      formData.append("valor", String(valorNumerico));

      // Anexar capa e PDF (funciona na web e no celular)
      if (capa) {
        await anexarArquivo(formData, "capa", capa, "capa.jpg", "image/jpeg");
      }

      if (pdf) {
        await anexarArquivo(formData, "pdf", pdf, "livro.pdf", "application/pdf");
      }

      let response: Response;

      if (editId !== null) {
        // Atualizar livro
        response = await fetch(`${API}/livros/${editId}`, {
          method: "PUT",
          headers: await cabecalhoAuth(),
          body: formData,
          cache: "no-store",
        });
      } else {
        // Cadastrar novo livro
        response = await fetch(`${API}/livros`, {
          method: "POST",
          headers: await cabecalhoAuth(),
          body: formData,
          cache: "no-store",
        });
      }

      const texto = await response.text();

      if (response.status === 401 || response.status === 403) {
        Alert.alert(
          "Sessão expirada",
          "Faça login novamente como administrador."
        );
        await sair();
        return;
      }

      console.log("STATUS SALVAR:", response.status);
      console.log("RESPOSTA:", texto);

      if (!response.ok) {
        Alert.alert(
          "Não foi possível salvar",
          mensagemDe(texto, response.status)
        );
        return;
      }

      const estavaEditando = editId !== null;

      await carregarLivros();

      setNome("");
      setGenero("");
      setValor("");
      setCapa(null);
      setPdf(null);
      setEditId(null);

      setModal(false);

      Alert.alert(
        "Sucesso",
        estavaEditando
          ? "Livro atualizado."
          : "Livro cadastrado."
      );
    } catch (err) {
      console.log("ERRO AO SALVAR LIVRO:", err);

      Alert.alert(
        "Erro",
        "Não foi possível salvar o livro. Verifique a conexão e tente novamente."
      );
    }
  }

  // Remover livro
  async function deletar(id: number) {
    Alert.alert(
      "Remover livro",
      "Tem certeza de que deseja remover este livro?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API}/livros/${id}`, {
                method: "DELETE",
                headers: await cabecalhoAuth(),
                cache: "no-store",
              });

              const texto = await response.text();

              if (response.status === 401 || response.status === 403) {
                Alert.alert(
                  "Sessão expirada",
                  "Faça login novamente como administrador."
                );
                await sair();
                return;
              }

              console.log("STATUS DELETE:", response.status);
              console.log("RESPOSTA DELETE:", texto);

              if (!response.ok) {
                Alert.alert(
                  "Não foi possível remover",
                  mensagemDe(texto, response.status)
                );
                return;
              }

              await carregarLivros();

              Alert.alert("Sucesso", "Livro removido.");
            } catch (err) {
              console.log("ERRO AO DELETAR:", err);

              Alert.alert(
                "Erro",
                "Não foi possível remover o livro. Verifique a conexão."
              );
            }
          },
        },
      ]
    );
  }

  // Preparar edição
  function editar(item: Livro) {
    setNome(item.nome);
    setGenero(item.genero);
    setValor(String(item.valor));
    setCapa(null);
    setPdf(null);
    setEditId(item.id);
    setModal(true);
  }

  // Abrir formulário de novo livro
  function novoLivro() {
    setNome("");
    setGenero("");
    setValor("");
    setCapa(null);
    setPdf(null);
    setEditId(null);
    setModal(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: tema }}>
        {/* NAVBAR */}

        <SafeAreaView style={styles.navbar}>
          <TouchableOpacity
            onPress={sair}
          >
            <Image source={Logout} style={styles.icon} />
          </TouchableOpacity>

          <Text
            style={{
              color: "white",
              fontSize: Mobile ? 16 : 20,
            }}
          >
            Olá, {usuario?.nome ?? "Usuário"}
          </Text>

          <TouchableOpacity
            onPress={
              tema === "#e9eaecde"
                ? Tema_Escuro
                : Tema_Claro
            }
          >
            <Image
              source={tema === "#e9eaecde" ? Lua : Sol}
              style={styles.icon}
            />
          </TouchableOpacity>
        </SafeAreaView>

        {/* LISTA DE LIVROS */}

        <FlatList
          data={livros}
          key={colunas}
          numColumns={colunas}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingVertical: 20,
            alignItems: "center",
            paddingBottom: 110,
          }}
          renderItem={({ item }) => (
            <View
              style={{
                padding: 15,
                margin: Mobile ? 8 : 20,
                width: Mobile ? Math.min(width - 24, 420) : 650,
                minHeight: Mobile ? 0 : 670,
                backgroundColor:
                  tema === "#e9eaecde" ? "white" : "#333",
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* CAPA */}

              {item.capa_url ? (
                <Image
                  source={{ uri: item.capa_url }}
                  style={[
                    styles.capa,
                    {
                      width: Mobile
                        ? Math.min(width - 100, 260)
                        : 600,
                      height: Mobile
                        ? Math.min((width - 100) * 1.15, 320)
                        : 500,
                    },
                  ]}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.semCapa}>
                  <Text>Sem capa disponível</Text>
                </View>
              )}

              {/* NOME */}

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: tema === "#e9eaecde" ? "#333" : "white",
                }}
              >
                {item.nome}
              </Text>

              {/* GÊNERO */}

              <Text
                style={{
                  color: tema === "#e9eaecde" ? "#333" : "white",
                }}
              >
                Gênero: {item.genero}
              </Text>

              {/* VALOR */}

              <Text
                style={{
                  marginBottom: 10,
                  color: tema === "#e9eaecde" ? "#333" : "white",
                }}
              >
                Valor: R$ {Number(item.valor).toFixed(2).replace(".", ",")} / mês
              </Text>

              {/* BOTÕES */}

              <View style={styles.botoesLivro}>
                <TouchableOpacity
                  onPress={() => editar(item)}
                  style={styles.btnEditar}
                >
                  <Text style={styles.textoBotao}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => deletar(item.id)}
                  style={styles.btnDeletar}
                >
                  <Text style={styles.textoBotao}>Remover</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ padding: 25 }}>
              <Text
                style={{
                  color: tema === "#e9eaecde" ? "#333" : "white",
                  textAlign: "center",
                }}
              >
                Nenhum livro encontrado.
              </Text>
            </View>
          }
        />

        {/* BOTÃO PARA ADICIONAR */}

        <TouchableOpacity
          style={styles.fab}
          onPress={novoLivro}
        >
          <Text style={styles.textoFab}>+</Text>
        </TouchableOpacity>

        {/* MODAL DE CADASTRO E EDIÇÃO */}

        <Modal
          visible={modal}
          transparent
          animationType="slide"
          onRequestClose={() => setModal(false)}
        >
          <View style={styles.modal}>
            <View
              style={[
                styles.modalBox,
                {
                  width: Mobile ? "94%" : "80%",
                  maxHeight: "90%",
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                <Text style={styles.tituloModal}>
                  {editId !== null
                    ? "Atualizar livro"
                    : "Cadastrar livro"}
                </Text>

                {/* NOME */}

                <TextInput
                  placeholder="Nome do livro"
                  value={nome}
                  onChangeText={setNome}
                  style={styles.input}
                />

                {/* GÊNERO */}

                <TextInput
                  placeholder="Gênero"
                  value={genero}
                  onChangeText={setGenero}
                  style={styles.input}
                />

                {/* CAPA */}

                <TouchableOpacity
                  onPress={selecionarCapa}
                  style={styles.input}
                >
                  <Text style={styles.textoArquivo}>
                    {capa ? capa.name : "Selecionar capa"}
                  </Text>
                </TouchableOpacity>

                {/* PDF */}

                <TouchableOpacity
                  onPress={selecionarPdf}
                  style={styles.input}
                >
                  <Text style={styles.textoArquivo}>
                    {pdf
                      ? pdf.name
                      : "Selecionar PDF do livro"}
                  </Text>
                </TouchableOpacity>

                {/* VALOR */}

                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="Valor do livro"
                  value={valor}
                  onChangeText={setValor}
                  style={styles.input}
                />

                {/* SALVAR */}

                <TouchableOpacity
                  style={styles.btnSalvar}
                  onPress={salvarLivro}
                >
                  <Text style={styles.textoBotao}>
                    {editId !== null ? "Atualizar" : "Salvar"}
                  </Text>
                </TouchableOpacity>

                {/* FECHAR */}

                <TouchableOpacity
                  onPress={() => setModal(false)}
                  style={styles.btnFechar}
                >
                  <Text style={{ color: "#cc1f00" }}>Fechar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

// ESTILOS

const styles = StyleSheet.create({
  navbar: {
    width: "100%",
    minHeight: 85,
    backgroundColor: "blue",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  icon: {
    width: 35,
    height: 35,
    resizeMode: "contain",
  },

  fab: {
    position: "absolute",
    bottom: 25,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "blue",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },

  textoFab: {
    color: "white",
    fontSize: 40,
    bottom: 3,
    fontWeight: "bold",
  },

  modal: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
  },

  modalBox: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
  },

  tituloModal: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },

  input: {
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    textAlign: "center",
    borderColor: "#aaa",
    minHeight: 45,
    justifyContent: "center",
  },

  textoArquivo: {
    textAlign: "center",
    color: "#222",
  },

  btnSalvar: {
    backgroundColor: "green",
    padding: 13,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 5,
  },

  btnFechar: {
    alignItems: "center",
    padding: 12,
  },

  botoesLivro: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },

  btnEditar: {
    backgroundColor: "#fc4e03",
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: "center",
  },

  btnDeletar: {
    backgroundColor: "red",
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: "center",
  },

  textoBotao: {
    color: "white",
    fontWeight: "bold",
  },

  capa: {
    maxWidth: "100%",
    borderRadius: 8,
    marginBottom: 10,
  },

  semCapa: {
    width: 180,
    height: 220,
    backgroundColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
});