import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  StatusBar,
} from "react-native";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

function LoginScreen({ email, setEmail, password, setPassword, handleLogin }) {
  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle="dark-content" />

      {/* LOGO */}
      <Image
        source={require("./assets/logo-removebg-preview.png")}
        style={styles.loginLogo}
        resizeMode="contain"
      />

      {/* TÊN APP */}
      <Text style={styles.loginTitle}>Fire Alert</Text>

      {/* EMAIL */}
      <TextInput
        style={styles.loginInput}
        placeholder="Email"
        placeholderTextColor="#BDBDBD"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* PASSWORD */}
      <TextInput
        style={styles.loginInput}
        placeholder="Mật khẩu"
        placeholderTextColor="#BDBDBD"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      {/* QUÊN MẬT KHẨU */}
      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => {
          Alert.alert(
            "Quên mật khẩu",
            "Chức năng này sẽ được kết nối với Firebase sau.",
          );
        }}
      >
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </TouchableOpacity>

      {/* ĐĂNG NHẬP */}
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Đăng nhập</Text>
      </TouchableOpacity>

      {/* ĐĂNG KÝ */}
      <View style={styles.registerContainer}>
        <Text style={styles.registerNormal}>Chưa có tài khoản?</Text>

        <TouchableOpacity
          onPress={() => {
            Alert.alert("Đăng ký", "Màn hình đăng ký sẽ được bổ sung.");
          }}
        >
          <Text style={styles.registerText}>Đăng ký</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  // =====================================================
  // STATE
  // =====================================================

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("home");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (email.trim() === "") {
      Alert.alert("Thông báo", "Vui lòng nhập Email!");
      return;
    }

    if (password.trim() === "") {
      Alert.alert("Thông báo", "Vui lòng nhập mật khẩu!");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      setIsLoggedIn(true);
      setCurrentScreen("home");
    } catch (error) {
      console.log("Firebase Error:", error.code);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        Alert.alert(
          "Đăng nhập thất bại",
          "Bạn đã nhập sai email hoặc mật khẩu!",
        );
      } else {
        Alert.alert("Lỗi", "Không thể đăng nhập. Vui lòng thử lại sau!");
      }
    }
  };
  // Dữ liệu cảm biến mẫu
  // Sau này sẽ thay bằng dữ liệu Firebase / MQTT
  const [sensorData, setSensorData] = useState({
    gas: 0,
    temperature: 0,
    flame: false,
    esp32: true,
  });
  const [historyData, setHistoryData] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const lastAlertRef = useRef(null);

  const processSensorData = async (data) => {
    let alertType = null;

    // =========================
    // XÁC ĐỊNH CẢNH BÁO
    // =========================

    // 1. Có lửa
    if (data.flame === true) {
      alertType = "fire";
    }

    // 2. Nhiệt độ cao + gas cao
    else if (data.temperature > 55 && data.gas > 1000) {
      alertType = "fire";
    }

    // 3. Gas cao
    else if (data.gas >= 300) {
      alertType = "gas";
    }

    // =========================
    // KHÔNG CÓ CẢNH BÁO
    // =========================

    if (!alertType) {
      lastAlertRef.current = null;
      return;
    }

    // =========================
    // ĐANG CÙNG MỘT CẢNH BÁO
    // KHÔNG LƯU LẠI
    // =========================

    if (lastAlertRef.current === alertType) {
      return;
    }

    // Ghi nhớ loại cảnh báo hiện tại
    lastAlertRef.current = alertType;

    // =========================
    // LƯU VÀO FIRESTORE
    // =========================

    try {
      await addDoc(collection(db, "alert_history"), {
        type: alertType,
        gas: data.gas,
        temperature: data.temperature,
        flame: data.flame,
        esp32: data.esp32,
        timestamp: serverTimestamp(),
      });

      console.log("Đã lưu lịch sử cảnh báo:", alertType);
    } catch (error) {
      console.log("Lỗi lưu lịch sử Firestore:", error);
    }
  };
  // =====================================================
  // NHẬN DỮ LIỆU REALTIME TỪ FIREBASE
  // =====================================================

  useEffect(() => {
    // Chưa đăng nhập thì không đọc Firebase
    if (!isLoggedIn) return;

    const systemRef = ref(rtdb, "HeThong");

    const unsubscribe = onValue(
      systemRef,
      async (snapshot) => {
        const data = snapshot.val();

        if (!data) return;

        console.log("Dữ liệu nhận từ RTDB:", data);

        const sensor = data.ThongSo_CamBien ?? {};
        const device = data.TinhTrang_ThietBi ?? {};

        const newSensorData = {
          gas: sensor.NongDo_Gas_ADC ?? 0,
          temperature: sensor.NhietDo_C ?? 0,
          flame: sensor.PhatHienLua ?? false,
          esp32: device.ESP32 === "Online",
        };

        // Cập nhật dữ liệu realtime cho Dashboard
        setSensorData(newSensorData);

        // Kiểm tra và lưu lịch sử nếu có cảnh báo
        await processSensorData(newSensorData);
      },
      (error) => {
        console.log("Lỗi đọc RTDB:", error);
      },
    );

    return () => unsubscribe();
  }, [isLoggedIn]);

  // =====================================================
  // ĐỌC LỊCH SỬ TỪ FIREBASE
  // =====================================================

  useEffect(() => {
    if (!isLoggedIn) return;

    const q = query(
      collection(db, "alert_history"),
      orderBy("timestamp", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            type: data.type,
            title: data.type === "fire" ? "FIRE WARNING" : "GAS WARNING",
            gas: data.gas ?? 0,
            temperature: data.temperature ?? 0,
            flame: data.flame ?? false,
            esp32: data.esp32 ?? false,
            timestamp: data.timestamp,
          };
        });

        setHistoryData(history);

        console.log("Lịch sử Firestore:", history);
      },
      (error) => {
        console.log("Lỗi đọc lịch sử Firestore:", error);
      },
    );

    return () => unsubscribe();
  }, [isLoggedIn]);
  // =====================================================
  // XÁC ĐỊNH TRẠNG THÁI CẢNH BÁO
  // =====================================================

  const getWarningStatus = () => {
    const { gas, temperature, flame } = sensorData;

    // Cháy
    if (flame === true) {
      return {
        type: "fire",
        title: "FIRE ALERT",
        icon: "flame",
        color: "#ffffff",
        background: "#FF2B2B",
      };
    }

    // Cháy theo nhiệt độ + gas
    if (temperature > 55 && gas > 1000) {
      return {
        type: "fire",
        title: "FIRE ALERT",
        icon: "flame",
        color: "#ffffff",
        background: "#FF2B2B",
      };
    }

    // Cảnh báo gas
    if (gas >= 300) {
      return {
        type: "gas",
        title: "GAS ALERT",
        icon: "warning",
        color: "#E6A800",
        background: "#FFE9A8",
      };
    }

    // Bình thường
    return {
      type: "normal",
      title: "AN TOÀN",
      icon: "checkmark-circle",
      color: "#198754",
      background: "#C8FFC8",
    };
  };

  // =====================================================
  // HEADER
  // =====================================================

  const ScreenHeader = ({ title }) => {
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    );
  };

  // =====================================================
  // DASHBOARD
  // =====================================================

  const DashboardScreen = () => {
    const warning = getWarningStatus();

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Dashboard" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.dashboardContent}
        >
          {/* TRẠNG THÁI */}
          <TouchableOpacity
            style={[styles.statusBox, { backgroundColor: warning.background }]}
            onPress={() => {
              if (warning.type === "fire") {
                setCurrentScreen("fireWarning");
              }

              if (warning.type === "gas") {
                setCurrentScreen("gasWarning");
              }
            }}
          >
            <Ionicons name={warning.icon} size={22} color={warning.color} />

            <Text style={[styles.statusText, { color: warning.color }]}>
              {warning.title}
            </Text>
          </TouchableOpacity>

          {/* GAS */}
          <SensorRow
            icon="flask"
            iconColor="#222"
            name="Gas"
            value={`${sensorData.gas} ppm`}
          />

          {/* NHIỆT ĐỘ */}
          <SensorRow
            icon="thermometer"
            iconColor="#E53935"
            name="Nhiệt độ"
            value={`${sensorData.temperature} °C`}
          />

          {/* NGỌN LỬA */}
          <SensorRow
            icon="flame"
            iconColor="#E53935"
            name="Ngọn lửa"
            value={sensorData.flame ? "Có" : "Không"}
            valueColor={sensorData.flame ? "#E53935" : "#333"}
          />

          {/* ESP32 */}
          <SensorRow
            icon="wifi"
            iconColor="#32CD32"
            name="Trạng thái"
            value={sensorData.esp32 ? "ESP32 online" : "ESP32 offline"}
            valueColor={sensorData.esp32 ? "#198754" : "#E53935"}
          />
          {/*NÚT NHẤN LƯU DỮ LIỆU
           <TouchableOpacity style={styles.loginButton} onPress={saveSensorData}>
            <Text style={styles.loginButtonText}>Lưu dữ liệu Firebase</Text>
          </TouchableOpacity> */}
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // SENSOR ROW
  // =====================================================

  const SensorRow = ({ icon, iconColor, name, value, valueColor = "#333" }) => {
    return (
      <View style={styles.sensorRow}>
        <Ionicons name={icon} size={21} color={iconColor} />

        <Text style={styles.sensorName}>{name}</Text>

        <Text style={[styles.sensorValue, { color: valueColor }]}>{value}</Text>
      </View>
    );
  };

  // =====================================================
  // FIRE WARNING
  // =====================================================

  const FireWarningScreen = () => {
    const data = selectedHistory || sensorData;
    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Cảnh báo" />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* FIRE ALERT */}
          <View style={styles.fireAlertBox}>
            <Ionicons name="flame" size={24} color="#FFFFFF" />

            <Text style={styles.fireAlertText}>FIRE ALERT</Text>
          </View>

          <View style={styles.warningContent}>
            <SensorRow
              icon="flask"
              iconColor="#222"
              name="Gas"
              value={`${data.gas} ppm`}
              valueColor="#E53935"
            />

            <SensorRow
              icon="thermometer"
              iconColor="#E53935"
              name="Nhiệt độ"
              value={`${data.temperature} °C`}
              valueColor="#E53935"
            />

            <SensorRow
              icon="flame"
              iconColor="#E53935"
              name="Ngọn lửa"
              value={data.flame ? "Có" : "Không"}
              valueColor="#E53935"
            />

            <SensorRow
              icon="wifi"
              iconColor="#32CD32"
              name="Trạng thái"
              value={data.esp32 ? "ESP32 online" : "ESP32 offline"}
              valueColor={data.esp32 ? "#198754" : "#E53935"}
            />

            {/* THỜI GIAN */}
            <View style={styles.timeRow}>
              <Ionicons name="time" size={18} color="#222" />

              <Text style={styles.timeText}>
                {data.timestamp
                  ? `${String(data.timestamp.toDate().getDate()).padStart(2, "0")}/${String(
                      data.timestamp.toDate().getMonth() + 1,
                    ).padStart(
                      2,
                      "0",
                    )}/${data.timestamp.toDate().getFullYear()} ${String(
                      data.timestamp.toDate().getHours(),
                    ).padStart(2, "0")}:${String(
                      data.timestamp.toDate().getMinutes(),
                    ).padStart(2, "0")}:${String(
                      data.timestamp.toDate().getSeconds(),
                    ).padStart(2, "0")}`
                  : "Đang cập nhật..."}
              </Text>
            </View>
          </View>

          {/* QUAY LẠI */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentScreen("home")}
          >
            <Text style={styles.backButtonText}>Quay lại Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // GAS WARNING
  // =====================================================

  const GasWarningScreen = () => {
    const data = selectedHistory || sensorData;
    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Cảnh báo" />

        <ScrollView>
          {/* GAS ALERT */}
          <View style={styles.gasAlertBox}>
            <Ionicons name="warning" size={24} color="#E6A800" />

            <Text style={styles.gasAlertText}>GAS ALERT</Text>
          </View>

          <View style={styles.warningContent}>
            <SensorRow
              icon="flask"
              iconColor="#222"
              name="Gas"
              value={`${data.gas} ppm`}
              valueColor="#E53935"
            />

            <SensorRow
              icon="thermometer"
              iconColor="#E53935"
              name="Nhiệt độ"
              value={`${data.temperature} °C`}
            />

            <SensorRow
              icon="flame"
              iconColor="#E53935"
              name="Ngọn lửa"
              value={data.flame ? "Có" : "Không"}
            />

            <SensorRow
              icon="wifi"
              iconColor="#32CD32"
              name="Trạng thái"
              value={data.esp32 ? "ESP32 online" : "ESP32 offline"}
              valueColor={data.esp32 ? "#198754" : "#E53935"}
            />

            <View style={styles.timeRow}>
              <Ionicons name="time" size={18} color="#222" />

              <Text style={styles.timeText}>
                {data.timestamp
                  ? `${String(data.timestamp.toDate().getDate()).padStart(2, "0")}/${String(
                      data.timestamp.toDate().getMonth() + 1,
                    ).padStart(
                      2,
                      "0",
                    )}/${data.timestamp.toDate().getFullYear()} ${String(
                      data.timestamp.toDate().getHours(),
                    ).padStart(2, "0")}:${String(
                      data.timestamp.toDate().getMinutes(),
                    ).padStart(2, "0")}:${String(
                      data.timestamp.toDate().getSeconds(),
                    ).padStart(2, "0")}`
                  : "Đang cập nhật..."}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentScreen("home")}
          >
            <Text style={styles.backButtonText}>Quay lại Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // HISTORY
  // =====================================================

  const HistoryScreen = () => {
    const formatTime = (timestamp) => {
      if (!timestamp) {
        return "Đang cập nhật...";
      }

      const date = timestamp.toDate();

      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Lịch sử" />

        <ScrollView showsVerticalScrollIndicator={false}>
          {historyData.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 50 }}>
              <Ionicons name="time-outline" size={45} color="#BBBBBB" />

              <Text
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  color: "#777",
                }}
              >
                Chưa có dữ liệu lịch sử
              </Text>
            </View>
          ) : (
            historyData.map((item) => {
              let itemStyle = styles.normalHistory;
              let textStyle = styles.normalHistoryText;
              let icon = "checkmark-circle";
              let iconColor = "#198754";

              if (item.type === "fire") {
                itemStyle = styles.fireHistory;
                textStyle = styles.fireHistoryText;
                icon = "flame";
                iconColor = "#E53935";
              }

              if (item.type === "gas") {
                itemStyle = styles.gasHistory;
                textStyle = styles.gasHistoryText;
                icon = "warning";
                iconColor = "#F0A500";
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.historyItem, itemStyle]}
                  onPress={() => {
                    setSelectedHistory(item);

                    if (item.type === "fire") {
                      setCurrentScreen("fireWarning");
                    } else if (item.type === "gas") {
                      setCurrentScreen("gasWarning");
                    }
                  }}
                >
                  <View style={styles.historyHeader}>
                    <Ionicons name={icon} size={20} color={iconColor} />

                    <Text style={textStyle}>{item.title}</Text>
                  </View>

                  <Text style={styles.historyTime}>
                    {formatTime(item.timestamp)}
                  </Text>

                  <Text
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 5,
                    }}
                  >
                    Gas: {item.gas} ppm | Nhiệt độ: {item.temperature} °C
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // DEVICE
  // =====================================================

  const DeviceScreen = () => {
    const devices = [
      {
        icon: "hardware-chip",
        name: "ESP32",
        status: "Online",
      },
      {
        icon: "flask",
        name: "Cảm biến khí Gas MQ2",
        status: "Hoạt động",
      },
      {
        icon: "flame",
        name: "Cảm biến lửa",
        status: "Hoạt động",
      },
      {
        icon: "thermometer",
        name: "DHT22",
        status: "Hoạt động",
      },
      {
        icon: "volume-high",
        name: "Buzzer",
        status: "Hoạt động",
      },
      {
        icon: "sync",
        name: "Relay / Quạt",
        status: "Hoạt động",
      },
    ];

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Thiết bị" />

        <ScrollView showsVerticalScrollIndicator={false}>
          {devices.map((device, index) => (
            <TouchableOpacity
              key={index}
              style={styles.deviceItem}
              onPress={() =>
                Alert.alert(device.name, `Trạng thái: ${device.status}`)
              }
            >
              <View style={styles.deviceLeft}>
                <Ionicons name={device.icon} size={20} color="#222" />

                <View style={styles.deviceTextContainer}>
                  <Text style={styles.deviceName}>{device.name}</Text>

                  <Text style={styles.deviceStatus}>{device.status}</Text>
                </View>
              </View>

              {/* STATUS DOT */}
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // SETTING
  // =====================================================

  const SettingScreen = () => {
    const showComingSoon = (title) => {
      Alert.alert(
        title,
        "Chức năng này sẽ được hoàn thiện ở bước tích hợp Firebase.",
      );
    };

    return (
      <View style={styles.screenContainer}>
        <ScreenHeader title="Tài khoản" />

        <ScrollView>
          {/* USER */}
          <View style={styles.userContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={27} color="#FFFFFF" />
            </View>

            <View>
              <Text style={styles.userName}>User's name</Text>

              <Text style={styles.userEmail}>{email || "user@gmail.com"}</Text>
            </View>
          </View>

          {/* THÔNG BÁO */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => showComingSoon("Thông báo")}
          >
            <Ionicons name="notifications-outline" size={22} color="#333" />

            <Text style={styles.settingText}>Thông báo</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#999"
              style={styles.rightArrow}
            />
          </TouchableOpacity>

          {/* ĐỔI MẬT KHẨU */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => showComingSoon("Đổi mật khẩu")}
          >
            <Ionicons name="lock-closed-outline" size={22} color="#333" />

            <Text style={styles.settingText}>Đổi mật khẩu</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#999"
              style={styles.rightArrow}
            />
          </TouchableOpacity>

          {/* THÔNG TIN */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              Alert.alert(
                "Fire Alert",
                "Ứng dụng giám sát và cảnh báo cháy.\n\nVersion 1.0.0",
              )
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#333"
            />

            <Text style={styles.settingText}>Thông tin ứng dụng</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#999"
              style={styles.rightArrow}
            />
          </TouchableOpacity>

          {/* ĐĂNG XUẤT */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              setIsLoggedIn(false);
              setCurrentScreen("home");
            }}
          >
            <Ionicons name="log-out-outline" size={22} color="#E00000" />

            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // =====================================================
  // BOTTOM NAVIGATION
  // =====================================================

  const BottomNavigation = () => {
    return (
      <View style={styles.bottomMenu}>
        {/* HOME */}
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => setCurrentScreen("home")}
        >
          <Ionicons
            name={currentScreen === "home" ? "home" : "home-outline"}
            size={23}
            color={currentScreen === "home" ? "#2196F3" : "#222"}
          />
        </TouchableOpacity>

        {/* HISTORY */}
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => setCurrentScreen("history")}
        >
          <Ionicons
            name={currentScreen === "history" ? "time" : "time-outline"}
            size={23}
            color={currentScreen === "history" ? "#2196F3" : "#222"}
          />
        </TouchableOpacity>

        {/* DEVICE */}
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => setCurrentScreen("device")}
        >
          <Ionicons
            name={
              currentScreen === "device"
                ? "hardware-chip"
                : "hardware-chip-outline"
            }
            size={23}
            color={currentScreen === "device" ? "#2196F3" : "#222"}
          />
        </TouchableOpacity>

        {/* SETTING */}
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => setCurrentScreen("setting")}
        >
          <Ionicons
            name={currentScreen === "setting" ? "settings" : "settings-outline"}
            size={23}
            color={currentScreen === "setting" ? "#2196F3" : "#222"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // =====================================================
  // LOGIN
  // =====================================================

  if (!isLoggedIn) {
    return (
      <LoginScreen
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
      />
    );
  }

  // =====================================================
  // APP
  // =====================================================

  return (
    <View style={styles.mainContainer}>
      {currentScreen === "home" && <DashboardScreen />}

      {currentScreen === "fireWarning" && <FireWarningScreen />}

      {currentScreen === "gasWarning" && <GasWarningScreen />}

      {currentScreen === "history" && <HistoryScreen />}

      {currentScreen === "device" && <DeviceScreen />}

      {currentScreen === "setting" && <SettingScreen />}

      {/* Không hiện bottom menu khi đang xem chi tiết cảnh báo */}
      {currentScreen !== "fireWarning" && currentScreen !== "gasWarning" && (
        <BottomNavigation />
      )}
    </View>
  );
}

// =====================================================
// STYLE
// =====================================================

const styles = StyleSheet.create({
  // ===================================================
  // LOGIN
  // ===================================================

  loginContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingHorizontal: 38,
    paddingTop: 70,
  },

  loginLogo: {
    width: 160,
    height: 160,
    marginBottom: 4,
  },

  loginTitle: {
    fontSize: 35,
    fontWeight: "bold",
    color: "#D71920",
    marginBottom: 38,
  },

  loginInput: {
    width: "100%",
    height: 55,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 3,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 15,
  },

  forgotButton: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 18,
  },

  forgotText: {
    fontSize: 11,
    color: "#333",
  },

  loginButton: {
    width: "100%",
    height: 47,
    backgroundColor: "#E00000",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  registerContainer: {
    flexDirection: "row",
    marginTop: 48,
  },

  registerNormal: {
    fontSize: 11,
    color: "#555",
    marginRight: 5,
  },

  registerText: {
    fontSize: 11,
    color: "#D71920",
    fontWeight: "500",
  },

  // ===================================================
  // MAIN
  // ===================================================

  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screenContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 25,
    paddingTop: 48,
    paddingBottom: 70,
  },

  header: {
    marginBottom: 18,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#111111",
  },

  // ===================================================
  // DASHBOARD
  // ===================================================

  dashboardContent: {
    paddingBottom: 30,
  },

  statusBox: {
    width: "100%",
    height: 80,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  statusText: {
    fontSize: 25,
    fontWeight: "bold",
    marginLeft: 9,
  },

  sensorRow: {
    width: "100%",
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  sensorName: {
    fontSize: 15,
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },

  sensorValue: {
    fontSize: 15,
    color: "#333",
    textAlign: "right",
  },

  // ===================================================
  // WARNING
  // ===================================================

  fireAlertBox: {
    width: "100%",
    height: 80,
    borderRadius: 20,
    backgroundColor: "#FF2525",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },

  fireAlertText: {
    color: "#f1f0f0",
    fontSize: 25,
    fontWeight: "bold",
    marginLeft: 9,
  },

  gasAlertBox: {
    width: "100%",
    height: 80,
    borderRadius: 20,
    backgroundColor: "#FFE8A3",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },

  gasAlertText: {
    color: "#E0A000",
    fontSize: 25,
    fontWeight: "bold",
    marginLeft: 9,
  },

  warningContent: {
    width: "100%",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 15,
  },

  timeText: {
    fontSize: 11,
    marginLeft: 10,
    color: "#333",
  },

  backButton: {
    width: "100%",
    height: 43,
    backgroundColor: "#EEEEEE",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  backButtonText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },

  // ===================================================
  // HISTORY
  // ===================================================

  historyItem: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 7,
  },

  fireHistory: {
    backgroundColor: "#FFD6D6",
  },

  gasHistory: {
    backgroundColor: "#FFF0B8",
  },

  normalHistory: {
    backgroundColor: "#CFFFCE",
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  fireHistoryText: {
    color: "#E53935",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 7,
  },

  gasHistoryText: {
    color: "#E0A000",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 7,
  },

  normalHistoryText: {
    color: "#198754",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 7,
  },

  historyTime: {
    fontSize: 13,
    color: "#555",
    marginTop: 5,
  },

  // ===================================================
  // DEVICE
  // ===================================================

  deviceItem: {
    width: "100%",
    minHeight: 65,
    backgroundColor: "#F3F3F3",
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 15,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  deviceLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  deviceTextContainer: {
    marginLeft: 12,
  },

  deviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
  },

  deviceStatus: {
    fontSize: 13,
    color: "#555",
    marginTop: 3,
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#19B84A",
  },

  // ===================================================
  // SETTING
  // ===================================================

  userContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 27,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 23,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  userName: {
    fontSize: 15,
    fontWeight: "600",
  },

  userEmail: {
    fontSize: 13,
    color: "#777",
    marginTop: 3,
  },

  settingItem: {
    width: "100%",
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    flexDirection: "row",
    alignItems: "center",
  },

  settingText: {
    fontSize: 15,
    color: "#333",
    marginLeft: 14,
  },

  rightArrow: {
    marginLeft: "auto",
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
  },

  logoutText: {
    color: "#E00000",
    fontSize: 15,
    marginLeft: 10,
  },

  // ===================================================
  // BOTTOM NAVIGATION
  // ===================================================

  bottomMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    height: 62,

    backgroundColor: "#FFFFFF",

    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  bottomButton: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
});
