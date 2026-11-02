import { useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp, Text, View } from "react-native";

interface Props {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
}

const MAX_TENTATIVAS = 3;

// Capa de livro com nova tentativa automática e placeholder.
// Se a imagem falhar (rede lenta, servidor acordando, erro temporário
// do storage), tenta de novo até 3 vezes antes de mostrar o ícone 📖.
export default function CapaLivro({ uri, style, resizeMode = "cover" }: Props) {
  const [tentativa, setTentativa] = useState(0);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setTentativa(0);
    setFalhou(false);
  }, [uri]);

  if (!uri || falhou) {
    return (
      <View
        style={[
          style as any,
          {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#17243B",
          },
        ]}
      >
        <Text style={{ fontSize: 28 }}>📖</Text>
      </View>
    );
  }

  // A partir da 2ª tentativa, muda a URL para furar cache de resposta ruim.
  const src =
    tentativa > 0 ? `${uri}${uri.includes("?") ? "&" : "?"}r=${tentativa}` : uri;

  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (tentativa + 1 < MAX_TENTATIVAS) {
          setTimeout(() => setTentativa((t) => t + 1), 1500 * (tentativa + 1));
        } else {
          setFalhou(true);
        }
      }}
    />
  );
}