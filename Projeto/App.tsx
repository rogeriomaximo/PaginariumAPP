import 'react-native-gesture-handler';

import Cadastro from './Cadastro';
import Inicio_Adm from './Pagina_Adm';
import Login from './Login';
import Inicio from './Pagina_Inicial';
import LivrosAlugados from './Livros_Alugados';
import Perfil from './Perfil';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Usuario = {
  id: number;
  nome: string;
  email: string;
  credito: number;
  tipo: string;
};

type UsuarioAdm = {
  id: number;
  nome: string;
  email: string;
  tipo: string;
};

type RootStackParamList = {
  Inicio: {
    usuario: Usuario;
    token: string;
  };

  Login: undefined;

  Cadastro: undefined;

  Inicio_Adm: {
    usuario: UsuarioAdm;
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [carregando, setCarregando] = useState(true);

  const [sessao, setSessao] = useState<{
    usuario: Usuario;
    token: string;
  } | null>(null);

  useEffect(() => {
    async function verificarSessao() {
      try {
        const tokenSalvo = await AsyncStorage.getItem('token');
        const usuarioSalvo = await AsyncStorage.getItem('usuario');

        if (tokenSalvo && usuarioSalvo) {
          const usuario = JSON.parse(usuarioSalvo);

          setSessao({
            token: tokenSalvo,
            usuario: usuario,
          });
        }
      } catch (err) {
        console.log('Erro ao recuperar sessão:', err);

        // Se houver algum problema com os dados salvos,
        // limpa a sessão para evitar comportamento estranho.
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('usuario');

        setSessao(null);
      } finally {
        setCarregando(false);
      }
    }

    verificarSessao();
  }, []);

  // Enquanto verifica o AsyncStorage,
  // não mostra Login nem nenhuma página.
  if (carregando) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#ad000e" />
      </View>
    );
  }

  // Decide qual página abrir depois do F5.
  const telaInicial = !sessao
    ? 'Login'
    : sessao.usuario.tipo === 'admin'
      ? 'Inicio_Adm'
      : 'Inicio';

  // Parâmetros iniciais das telas de usuário comum.
  const paramsUsuario =
    sessao && sessao.usuario.tipo !== 'admin'
      ? {
          usuario: sessao.usuario,
          token: sessao.token,
        }
      : undefined;

  return (
    <>
      <StatusBar style="dark" />

      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={telaInicial}
        >
          <Stack.Screen
            name="Inicio"
            component={Inicio}
            initialParams={paramsUsuario}
            options={{
              headerShown: false,
              title: 'Pagina Inicial',
            }}
          />

          <Stack.Screen
            name="Login"
            component={Login}
            options={{
              headerShown: false,
              title: 'Realizar Login',
            }}
          />

          <Stack.Screen
            name="Cadastro"
            component={Cadastro}
            options={{
              headerShown: false,
              title: 'Cadastrar-se',
            }}
          />

          <Stack.Screen
            name="Inicio_Adm"
            component={Inicio_Adm}
            initialParams={
              sessao && sessao.usuario.tipo === 'admin'
                ? {
                    usuario: {
                      id: sessao.usuario.id,
                      nome: sessao.usuario.nome,
                      email: sessao.usuario.email,
                      tipo: sessao.usuario.tipo,
                    },
                    token: sessao.token,
                  }
                : undefined
            }
            options={{
              headerShown: false,
              title: 'Pagina do Administrador',
            }}
          />

          <Stack.Screen
            name="LivrosAlugados"
            component={LivrosAlugados}
            initialParams={paramsUsuario}
            options={{
              headerShown: false,
              title: 'Livros Alugados',
            }}
          />

          <Stack.Screen
            name="Perfil"
            component={Perfil}
            initialParams={paramsUsuario}
            options={{
              headerShown: false,
              title: 'Perfil',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}