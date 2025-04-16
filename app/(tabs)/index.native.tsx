import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Svg } from 'react-native-svg';
import { LineChart } from "react-native-chart-kit";

const CONVERSION_FACTOR = 18.0182;
const HISTORY_STORAGE_KEY = '@glucoSwapHistory';
const MAX_HISTORY_ITEMS_DISPLAYED = 100;
const MAX_HISTORY_ITEMS_RENDERED = 20;
const MAX_INPUT_LENGTH = 5;
const HISTORY_ITEM_APPROX_HEIGHT = 55;
const HISTORY_MAX_VISIBLE_ITEMS = 4;
const MIN_POINTS_FOR_CHART = 2;
const MAX_CHART_LABELS = 6;

type Unit = 'mg/dL' | 'mmol/L';

interface HistoryItem {
  id: string;
  timestamp: number;
  mgdlValue: number;
  mmolValue: number;
}

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scale = (size: number): number => (width / guidelineBaseWidth) * size;
const moderateScale = (size: number, factor = 0.5): number => size + (scale(size) - size) * factor;


export default function GlucoSwapScreen() {
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>('mg/dL');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const storedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (storedHistory !== null) {
          const parsedHistory = JSON.parse(storedHistory);
          setHistory(parsedHistory.slice(0, MAX_HISTORY_ITEMS_DISPLAYED));
        } else {
          setHistory([]);
        }
      } catch (e) {
        console.error('Failed to load history.', e);
        Alert.alert('Error', 'Could not load conversion history.');
      } finally {
        setIsHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (!isHistoryLoading) {
      const saveHistory = async () => {
        try {
          await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS_DISPLAYED)));
        } catch (e) {
          console.error('Failed to save history.', e);
        }
      };
      saveHistory();
    }
  }, [history, isHistoryLoading]);

  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).replace(',', '');
  }, []);

   const formatTimestampForChart = useCallback((timestamp: number): string => {
     const date = new Date(timestamp);
     return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
   }, []);

  const isInputValid = useMemo(() => {
    const numericValue = parseFloat(inputValue);
    return !isNaN(numericValue) && numericValue > 0;
  }, [inputValue]);

  const handleUnitChange = (newUnit: Unit) => {
    setSelectedUnit(newUnit);
    setInputValue('');
  };

  const handleConvert = useCallback(() => {
    if (!isInputValid) {
      return;
    }

    Keyboard.dismiss();
    const value = parseFloat(inputValue);

    let mgdlValue: number;
    let mmolValue: number;
    let resultText: string;

    if (selectedUnit === 'mg/dL') {
      mgdlValue = value;
      mmolValue = value / CONVERSION_FACTOR;
      resultText = `${mgdlValue.toFixed(0)} mg/dL ≈ ${mmolValue.toFixed(2)} mmol/L`;
    } else {
      mmolValue = value;
      mgdlValue = value * CONVERSION_FACTOR;
      resultText = `${mmolValue.toFixed(2)} mmol/L ≈ ${mgdlValue.toFixed(0)} mg/dL`;
    }

    const newEntry: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mgdlValue: mgdlValue,
      mmolValue: mmolValue,
    };

    setHistory(prevHistory => [newEntry, ...prevHistory].slice(0, MAX_HISTORY_ITEMS_DISPLAYED));

    Alert.alert(
      'Conversion Result',
      resultText,
      [
        {
          text: 'OK',
          onPress: () => setInputValue(''),
        },
      ]
    );
  }, [inputValue, selectedUnit, history, isInputValid]);

  const handleClearHistory = useCallback(() => {
    Keyboard.dismiss();
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete all conversion history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setHistory([]);
            setInputValue('');
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  const renderHistoryItem = (item: HistoryItem) => (
    <View key={item.id} style={styles.historyItem}>
      <Text style={styles.historyTextTime} numberOfLines={1} ellipsizeMode="tail">{formatTimestamp(item.timestamp)}</Text>
      <Text style={styles.historyTextValue}>{item.mgdlValue.toFixed(0)}</Text>
      <Text style={styles.historyTextValue}>{item.mmolValue.toFixed(2)}</Text>
    </View>
  );


  const historyListMaxHeight = useMemo(() => {
      return (HISTORY_ITEM_APPROX_HEIGHT * HISTORY_MAX_VISIBLE_ITEMS) + moderateScale(30);
  }, []);

  const chartYUnit: Unit = selectedUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL';
  const chartYAxisSuffix = chartYUnit === 'mg/dL' ? ' mg/dL' : ' mmol/L';
  const chartLegend = [`Glucose (${chartYUnit})`];
  const chartTitleText = `Glucose Trend (${chartYUnit})`;
  const chartDecimalPlaces = chartYUnit === 'mg/dL' ? 0 : 1;

  const chartKitData = useMemo(() => {
    if (history.length < MIN_POINTS_FOR_CHART) {
      return null;
    }
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

    const labels: string[] = [];
    const dataPoints: number[] = [];
    const step = Math.max(1, Math.floor(sortedHistory.length / MAX_CHART_LABELS));

    sortedHistory.forEach((item, index) => {
       const yValue = chartYUnit === 'mg/dL' ? item.mgdlValue : item.mmolValue;
       if (index === 0 || index === sortedHistory.length - 1 || index % step === 0) {
          labels.push(formatTimestampForChart(item.timestamp));
          dataPoints.push(yValue);
       } else if (sortedHistory.length <= MAX_CHART_LABELS) {
          labels.push(formatTimestampForChart(item.timestamp));
          dataPoints.push(yValue);
       }
    });

     if (labels.length > 0 && dataPoints.length > 0) {
        const firstHistoryLabel = formatTimestampForChart(sortedHistory[0].timestamp);
        if (labels[0] !== firstHistoryLabel) {
           labels.unshift(firstHistoryLabel);
           dataPoints.unshift(chartYUnit === 'mg/dL' ? sortedHistory[0].mgdlValue : sortedHistory[0].mmolValue);
        }
        const lastHistoryLabel = formatTimestampForChart(sortedHistory[sortedHistory.length - 1].timestamp);
        if (labels[labels.length - 1] !== lastHistoryLabel) {
           labels.push(lastHistoryLabel);
           dataPoints.push(chartYUnit === 'mg/dL' ? sortedHistory[sortedHistory.length - 1].mgdlValue : sortedHistory[sortedHistory.length - 1].mmolValue);
        }
     }

     const finalLabels = labels.slice(0, dataPoints.length);

     if (finalLabels.length < MIN_POINTS_FOR_CHART) return null;

    return {
      labels: finalLabels,
      datasets: [
        {
          data: dataPoints,
          color: (opacity = 1) => `rgba(138, 43, 226, ${opacity})`,
          strokeWidth: 3
        }
      ],
      legend: chartLegend
    };
  }, [history, formatTimestampForChart, chartYUnit]);

  const dynamicChartConfig = useMemo(() => ({
      backgroundColor: "#1E1E2E",
      backgroundGradientFrom: "#1E1E2E",
      backgroundGradientTo: "#2C2C3E",
      decimalPlaces: chartDecimalPlaces,
      color: (opacity = 1) => `rgba(221, 221, 221, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(204, 204, 204, ${opacity})`,
      style: {
        borderRadius: moderateScale(12),
      },
      propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: "#A040FF"
      }
  }), [chartDecimalPlaces]);


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={'light-content'} backgroundColor={styles.safeArea.backgroundColor} />
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>GlucoSwap</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Convert From:</Text>
            <View style={styles.radioContainer}>
              <TouchableOpacity
                style={styles.radioButton}
                onPress={() => handleUnitChange('mg/dL')}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, selectedUnit === 'mg/dL' && styles.radioOuterSelected]}>
                  {selectedUnit === 'mg/dL' && <View style={styles.radioInnerSelected} />}
                </View>
                <Text style={styles.radioLabel}>mg/dL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.radioButton}
                onPress={() => handleUnitChange('mmol/L')}
                activeOpacity={0.7}
              >
                <View style={[styles.radioOuter, selectedUnit === 'mmol/L' && styles.radioOuterSelected]}>
                  {selectedUnit === 'mmol/L' && <View style={styles.radioInnerSelected} />}
                </View>
                <Text style={styles.radioLabel}>mmol/L</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Enter Value:</Text>
            <TextInput
              style={styles.input}
              placeholder={`Enter ${selectedUnit} value`}
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={inputValue}
              onChangeText={setInputValue}
              returnKeyType="done"
              maxLength={MAX_INPUT_LENGTH}
              autoCorrect={false}
              spellCheck={false}
              onSubmitEditing={handleConvert}
            />
          </View>
          <TouchableOpacity
            style={[styles.convertButton, !isInputValid && styles.convertButtonDisabled]}
            onPress={handleConvert}
            disabled={!isInputValid}
            activeOpacity={isInputValid ? 0.8 : 1.0}
          >
            <Text style={styles.convertButtonText}>Convert</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.historyCard]}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Conversion History</Text>
            {!isHistoryLoading && history.length > 0 && (
              <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton} activeOpacity={0.7}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.historyListContainer, { maxHeight: historyListMaxHeight }]}>
            {isHistoryLoading ? (
              <ActivityIndicator size="large" color="#8A2BE2" style={styles.loadingIndicator} />
            ) : history.length === 0 ? (
              <View style={styles.noHistoryContainer}>
                <Text style={styles.noHistoryText}>No conversions recorded yet.</Text>
              </View>
            ) : (
              <ScrollView nestedScrollEnabled={true} style={styles.innerHistoryScroll}>
                <View style={styles.historyItemHeader}>
                   <Text style={[styles.historyHeaderText, styles.historyHeaderTextTime]}>Time</Text>
                   <Text style={styles.historyHeaderText}>mg/dL</Text>
                   <Text style={styles.historyHeaderText}>mmol/L</Text>
                </View>
                {history.slice(0, MAX_HISTORY_ITEMS_RENDERED).map(item => renderHistoryItem(item))}
              </ScrollView>
            )}
          </View>
        </View>

        {!isHistoryLoading && chartKitData && (
           <View style={styles.card}>
             <Text style={styles.chartTitle}>{chartTitleText}</Text>
             <View style={styles.chartContainer}>
               <LineChart
                   data={chartKitData}
                   width={width * 0.85}
                   height={moderateScale(250)}
                   yAxisSuffix={chartYAxisSuffix}
                   yAxisInterval={1}
                   chartConfig={dynamicChartConfig}
                   bezier
                   style={{
                       marginVertical: 8,
                       borderRadius: moderateScale(12)
                   }}
                   verticalLabelRotation={-15}
               />
             </View>
           </View>
        )}
        {!isHistoryLoading && history.length < MIN_POINTS_FOR_CHART && (
           <View style={styles.card}>
               <Text style={styles.noHistoryText}>Need at least {MIN_POINTS_FOR_CHART} history entries to display chart.</Text>
           </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
     flex: 1,
     width: '100%',
  },
  container: {
    paddingTop: height * 0.1,
    paddingBottom: height * 0.05,
    paddingHorizontal: width * 0.05,
    backgroundColor: '#121212',
    alignItems: 'center',
    minHeight: height * 0.95,
  },
  card: {
    backgroundColor: '#1E1E2E',
    borderRadius: moderateScale(12),
    padding: width * 0.05,
    marginBottom: height * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    width: '100%',
    borderWidth: 1,
    borderColor: '#9370DB',
  },
  title: {
    fontSize: moderateScale(28, 0.4),
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: height * 0.03,
  },
  section: {
    marginBottom: height * 0.025,
  },
  label: {
    fontSize: moderateScale(16, 0.3),
    color: '#DDD',
    marginBottom: height * 0.01,
    fontWeight: '500',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: width * 0.08,
    paddingVertical: height * 0.005,
  },
  radioOuter: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: '#8A2BE2',
    marginRight: width * 0.02,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#A040FF',
  },
  radioInnerSelected: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: '#8A2BE2',
  },
  radioLabel: {
    fontSize: moderateScale(16, 0.3),
    color: '#FFF',
  },
  input: {
    backgroundColor: '#2C2C3E',
    color: '#FFF',
    paddingHorizontal: width * 0.04,
    paddingVertical: Platform.OS === 'ios' ? height * 0.018 : height * 0.015,
    borderRadius: moderateScale(8),
    fontSize: moderateScale(16, 0.3),
    borderWidth: 1,
    borderColor: '#BDB0D0',
  },
  convertButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: height * 0.018,
    borderRadius: moderateScale(8),
    alignItems: 'center',
    marginTop: height * 0.01,
    opacity: 1,
  },
  convertButtonDisabled: {
    backgroundColor: '#5A1D9A',
    opacity: 0.6,
  },
  convertButtonText: {
    color: '#FFF',
    fontSize: moderateScale(16, 0.3),
    fontWeight: 'bold',
  },
  historyCard: {
    paddingBottom: width * 0.03,
    flexShrink: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: height * 0.015,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: height * 0.01,
  },
  historyTitle: {
    fontSize: moderateScale(24, 0.4),
    fontWeight: 'bold',
    color: '#DDD',
  },
  clearButton: {
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: '#333',
  },
  clearButtonText: {
    color: '#FF6B6B',
    fontSize: moderateScale(14, 0.3),
    fontWeight: 'bold',
  },
  historyListContainer: {
    // Defines max height for the scrollable area
  },
  innerHistoryScroll: {
    // Inner scroll view for history items
  },
  loadingIndicator: {
    marginTop: height * 0.05,
    paddingVertical: moderateScale(20),
  },
  noHistoryContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: moderateScale(30),
  },
  noHistoryText: {
    color: '#AAA',
    textAlign: 'center',
    fontSize: moderateScale(16, 0.3),
    fontStyle: 'italic',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: height * 0.01,
    paddingHorizontal: width * 0.01,
    backgroundColor: '#1E1E2E',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 5,
  },
  historyHeaderText: {
    color: '#BBB',
    fontWeight: 'bold',
    fontSize: moderateScale(14, 0.3),
    flex: 1,
    textAlign: 'left',
  },
  historyHeaderTextTime: {
    flex: 1.5,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.01,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a4a',
    minHeight: HISTORY_ITEM_APPROX_HEIGHT - moderateScale(10),
  },
  historyTextTime: {
    color: '#CCC',
    fontSize: moderateScale(13, 0.3),
    flex: 1.5,
    textAlign: 'left',
  },
  historyTextValue: {
    color: '#FFF',
    fontSize: moderateScale(14, 0.3),
    flex: 1,
    textAlign: 'left',
  },
  chartTitle: {
    fontSize: moderateScale(18, 0.3),
    fontWeight: 'bold',
    color: '#DDD',
    textAlign: 'center',
    marginBottom: height * 0.02,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
