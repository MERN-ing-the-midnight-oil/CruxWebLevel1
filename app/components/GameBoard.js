import React, { useState, useRef, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	Image,
	Button,
	Dimensions,
	TouchableWithoutFeedback,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import cliches from "../data/cliches";
import colorsandshapes from "../data/colorsandshapes";
import easylevel from "../data/easylevel";
import homophones from "../data/homophones";
import { moveFocus, moveFocusAndDelete } from "../utils/gameplayUtils";
import {
	getClueCellStyle,
	getClueColor,
	createCluePaths,
} from "../utils/clueUtils";
import styles from "./GameBoardStyles";

const { width, height } = Dimensions.get("window");

const GameBoard = () => {
	const levels = { easylevel, colorsandshapes, cliches, homophones };
	const [currentLevel, setCurrentLevel] = useState("");
	const [guesses, setGuesses] = useState({});
	const [correctAnswers, setCorrectAnswers] = useState({});
	const [lastUpdatedPosition, setLastUpdatedPosition] = useState(null);
	const [showPickerModal, setShowPickerModal] = useState(false);
	const [showClueModal, setShowClueModal] = useState(false);
	const [currentClueUrl, setCurrentClueUrl] = useState("");
	const [currentClueKey, setCurrentClueKey] = useState("");
	const [gameContainerWidth, setGameContainerWidth] = useState(0);
	const [focusDirection, setFocusDirection] = useState("across");
	const inputRefs = useRef({});
	const [cluePaths, setCluePaths] = useState({});

	useEffect(() => {
		const loadGuesses = async () => {
			const savedGuesses = await AsyncStorage.getItem(
				`guesses-${currentLevel}`
			);
			if (savedGuesses) {
				setGuesses(JSON.parse(savedGuesses));
			} else {
				setGuesses({});
			}
		};
		loadGuesses();
	}, [currentLevel]);

	useEffect(() => {
		const saveGuesses = async () => {
			const savedGuesses = JSON.stringify(guesses);
			await AsyncStorage.setItem(`guesses-${currentLevel}`, savedGuesses);
		};
		saveGuesses();
	}, [guesses, currentLevel]);

	useEffect(() => {
		const loadCorrectAnswers = async () => {
			const savedCorrectAnswers = await AsyncStorage.getItem(
				`correctAnswers-${currentLevel}`
			);
			if (savedCorrectAnswers) {
				const parsedCorrectAnswers = JSON.parse(savedCorrectAnswers);
				setCorrectAnswers(parsedCorrectAnswers);
				console.log("Correct answers loaded:", parsedCorrectAnswers);
			} else {
				setCorrectAnswers({});
			}
		};
		loadCorrectAnswers();
	}, [currentLevel]);

	useEffect(() => {
		const saveCorrectAnswers = async () => {
			const savedCorrectAnswers = JSON.stringify(correctAnswers);
			await AsyncStorage.setItem(
				`correctAnswers-${currentLevel}`,
				savedCorrectAnswers
			);
		};
		saveCorrectAnswers();
	}, [correctAnswers, currentLevel]);

	useEffect(() => {
		if (currentLevel) {
			const numClues = levels[currentLevel].clues
				? Object.keys(levels[currentLevel].clues).length
				: 0;
			setCluePaths(createCluePaths(currentLevel, numClues));
		}
	}, [currentLevel]);

	const handleLevelChange = (value) => {
		setCurrentLevel(value);
		setGuesses({});
		setCorrectAnswers({});
		setLastUpdatedPosition(null);
		setShowPickerModal(false);
	};

	const clearStorageForLevel = async (level) => {
		try {
			await AsyncStorage.removeItem(`guesses-${level}`);
			await AsyncStorage.removeItem(`correctAnswers-${level}`);
		} catch (e) {
			console.error("Failed to clear AsyncStorage", e);
		}
	};

	const clearGuesses = async () => {
		console.log("Erase All and Start Over button used. Letters cleared."); // Log the action
		await clearStorageForLevel(currentLevel);
		setGuesses({});
		setCorrectAnswers({});
	};

	const renderCell = (cell, rowIndex, colIndex) => {
		const position = `${rowIndex}-${colIndex}`;
		const cellSize = gameContainerWidth / 6;
		let cellStyle = {
			borderColor: "#ccc",
			borderWidth: 1,
			width: cellSize,
			height: cellSize,
		};

		if (cell.clue) {
			cellStyle = {
				...cellStyle,
				...getClueCellStyle(levels[currentLevel].grid, rowIndex, colIndex),
			};
			return (
				<TouchableOpacity
					key={position}
					style={[styles.clueCell, cellStyle]}
					onPressIn={(e) => handleTouchStart(cell.clue, e)}
				/>
			);
		} else if (cell.empty) {
			return (
				<View
					key={position}
					style={[styles.emptyCell, cellStyle]}
				/>
			);
		} else {
			const isCorrectGuess =
				guesses[position] && guesses[position] === cell.letter;
			if (isCorrectGuess) {
				cellStyle = { ...cellStyle, ...styles.correctGuessCell };
			}

			return (
				<View
					key={position}
					style={[styles.letterCell, cellStyle]}>
					<TextInput
						ref={(el) => (inputRefs.current[position] = el)}
						maxLength={1}
						value={guesses[position] || ""}
						onChangeText={(text) => {
							handleInputChange(position, text);
						}}
						onKeyPress={({ nativeEvent: { key } }) =>
							handleKeyPress(position, key)
						}
						onFocus={() => handleFocus(position)}
						onBlur={() => handleBlur(position)}
						style={styles.input}
						autoCapitalize="characters"
						autoCorrect={false}
						keyboardType="default"
						editable={!correctAnswers[position]} // Correct answers should not be editable
					/>
				</View>
			);
		}
	};

	const handleInputChange = (position, text) => {
		const isCorrect = correctAnswers[position];
		const newGuess = text.toUpperCase();

		if (isCorrect) {
			console.log(
				`Input change attempted on locked cell at position ${position}. Ignored.`
			);
			return; // Don't allow changes to correct answers
		}

		console.log(`User entered the letter ${newGuess} at position ${position}`);

		if (newGuess === "") {
			setGuesses((prevGuesses) => {
				const updatedGuesses = { ...prevGuesses };
				delete updatedGuesses[position];
				return updatedGuesses;
			});
			moveFocusAndDelete(
				position,
				focusDirection,
				inputRefs,
				correctAnswers,
				guesses,
				setGuesses,
				levels,
				currentLevel
			);
		} else {
			setGuesses((prevGuesses) => {
				const updatedGuesses = {
					...prevGuesses,
					[position]: newGuess.slice(-1),
				};
				return updatedGuesses;
			});

			if (
				newGuess.slice(-1) ===
				levels[currentLevel].grid[position.split("-")[0]][
					position.split("-")[1]
				].letter
			) {
				setCorrectAnswers((prevAnswers) => ({
					...prevAnswers,
					[position]: newGuess.slice(-1),
				}));
				console.log(
					`Correct answer entered at position ${position}. Cell is now locked.`
				);
			}

			setLastUpdatedPosition(position);
			moveFocus(
				position,
				"forward",
				focusDirection,
				inputRefs,
				correctAnswers,
				levels,
				currentLevel
			);
		}
	};

	const handleKeyPress = (position, key) => {
		if (key === "Backspace") {
			setGuesses((prevGuesses) => {
				const updatedGuesses = { ...prevGuesses };
				delete updatedGuesses[position];
				return updatedGuesses;
			});
			moveFocusAndDelete(
				position,
				focusDirection,
				inputRefs,
				correctAnswers,
				guesses,
				setGuesses,
				levels,
				currentLevel
			);
		}
	};

	const handleFocus = (position) => {
		const isCorrect = correctAnswers[position];
		const [row, col] = position.split("-").map(Number);

		if (lastUpdatedPosition) {
			const [lastRow, lastCol] = lastUpdatedPosition.split("-").map(Number);

			if (row !== lastRow) {
				console.log("Shifting focus down due to manual entry");
				setFocusDirection("down");
			} else if (col !== lastCol) {
				console.log("Shifting focus right due to manual entry");
				setFocusDirection("across");
			}
		}

		console.log(`Attempting to focus on cell at position ${position}.`);
		console.log(` - Is cell correct: ${isCorrect ? "Yes" : "No"}`);

		if (isCorrect) {
			console.log(
				`Focus attempted on locked cell at position ${position}. Blurring.`
			);
			inputRefs.current[position].blur();
		} else {
			console.log(`Focus allowed on editable cell at position ${position}.`);
			if (guesses[position]) {
				setGuesses((prevGuesses) => ({
					...prevGuesses,
					[position]: "",
				}));
			}
		}
	};

	const handleBlur = (position) => {};

	const handleTouchStart = (clueKey, e) => {
		e.stopPropagation();
		console.log("User tapped a cell");
		setCurrentClueKey(clueKey);
		setCurrentClueUrl(cluePaths[clueKey]);
		setShowClueModal(true);

		const [row, col] = clueKey.split("-").map(Number);
		const [lastRow, lastCol] = lastUpdatedPosition
			? lastUpdatedPosition.split("-").map(Number)
			: [];

		if (lastUpdatedPosition) {
			if (row !== lastRow) {
				console.log("Shifting focus down due to manual entry");
				setFocusDirection("down");
			} else if (col !== lastCol) {
				console.log("Shifting focus right due to manual entry");
				setFocusDirection("across");
			}
		}
	};

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			{!currentLevel && (
				<View
					style={{
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "transparent", // Set the background color to orange for testing
						padding: 20,
					}}>
					<Button
						title="Select Level"
						onPress={() => setShowPickerModal(true)}
					/>
				</View>
			)}

			{currentLevel && (
				<KeyboardAwareFlatList
					ListHeaderComponent={
						<View>
							{/* Top "Select Level" Button */}
							<View style={styles.selectLevelButtonContainer}>
								<TouchableOpacity
									style={styles.selectLevelButton}
									onPress={() => setShowPickerModal(true)}>
									<Text style={styles.selectLevelButtonText}>Select Level</Text>
								</TouchableOpacity>
							</View>

							{/* Level Title and Subtitle */}
							<View style={styles.header}>
								<Text style={styles.levelTitle}>
									{levels[currentLevel]?.title || "Level Title"}
								</Text>
								{levels[currentLevel]?.secondaryTitle && (
									<Text style={styles.secondaryTitle}>
										{levels[currentLevel].secondaryTitle}
									</Text>
								)}
							</View>
						</View>
					}
					data={levels[currentLevel]?.grid || []}
					renderItem={({ item: row, index: rowIndex }) => (
						<View
							key={rowIndex}
							style={{ flexDirection: "row", width: "100%" }}>
							{row.map((cell, colIndex) =>
								renderCell(cell, rowIndex, colIndex)
							)}
						</View>
					)}
					keyExtractor={(item, index) => index.toString()}
					contentContainerStyle={styles.gameContainer}
					onLayout={(event) => {
						const { width } = event.nativeEvent.layout;
						setGameContainerWidth(width);
					}}
					ListFooterComponent={() => (
						<View style={styles.footer}>
							<TouchableOpacity
								style={styles.selectLevelButton}
								onPress={() => setShowPickerModal(true)}>
								<Text style={styles.selectLevelButtonText}>Select Level</Text>
							</TouchableOpacity>
							<Button
								title="Erase All and Start Over"
								onPress={clearGuesses}
							/>
						</View>
					)}
				/>
			)}

			{showPickerModal && (
				<Modal
					transparent={true}
					animationType="slide"
					visible={showPickerModal}
					onRequestClose={() => setShowPickerModal(false)}>
					<View style={styles.pickerModal}>
						<View style={styles.pickerWrapper}>
							<View style={styles.pickerContainer}>
								<Picker
									selectedValue={currentLevel}
									onValueChange={(value) => {
										if (value) {
											handleLevelChange(value);
										}
									}}
									style={styles.picker}>
									<Picker.Item
										label="Please choose a level:"
										value=""
										color="#999"
									/>
									<Picker.Item
										label="Getting Started"
										value="easylevel"
									/>
									<Picker.Item
										label="Colors and Shapes"
										value="colorsandshapes"
									/>
									<Picker.Item
										label="Cliches"
										value="cliches"
									/>
									<Picker.Item
										label="Homophones"
										value="homophones"
									/>
								</Picker>
							</View>
							<TouchableOpacity
								style={styles.closeButton}
								onPress={() => setShowPickerModal(false)}>
								<Text style={styles.closeButtonText}>Close</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>
			)}

			{showClueModal && (
				<Modal
					transparent={true}
					animationType="fade"
					visible={showClueModal}
					onRequestClose={() => setShowClueModal(false)}>
					<TouchableWithoutFeedback onPress={() => setShowClueModal(false)}>
						<View style={styles.modalBackdrop}>
							<View
								style={[
									styles.modalContent,
									{ borderColor: getClueColor(currentClueKey) },
								]}>
								<Image
									source={{ uri: currentClueUrl }}
									style={styles.modalImage}
									resizeMode="contain"
								/>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</Modal>
			)}
		</View>
	);
};

export default GameBoard;
