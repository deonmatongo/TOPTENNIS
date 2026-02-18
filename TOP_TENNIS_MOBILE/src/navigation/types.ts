export type NativeStackScreenProps<T = Record<string, unknown>> = {
  navigation: any;
  route: {
    params: T;
  };
};
