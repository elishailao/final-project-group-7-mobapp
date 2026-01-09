import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Modal, ScrollView, StatusBar, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UnifiedEventCard from '../components/UnifiedEventCard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import HeaderBanner from '../components/HeaderBanner';

type Event = {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  location: string;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  coverPhoto?: string;
  volunteerCategories: string[];
  canceled?: boolean;
  tags?: string[];
  currentVolunteers?: number;
  maxVolunteers?: number;
};

type PendingVolunteer = {
  id: string;
  eventId: string;
  eventTitle: string;
  volunteerName: string;
  volunteerEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  position: string;
};

type Volunteer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  assignedEvents: string[];
  status: 'active' | 'inactive';
};

const TAG_OPTIONS = [
  'Environmental',
  'Animal',
  'Social Work',
  'Healthcare',
  'Blood Donation',
  'Sports',
  'Others',
];

export default function VolunteerDashboard() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [storedEvents, savedEvents, storedVolunteers] = await Promise.all([
        AsyncStorage.getItem('events'),
        AsyncStorage.getItem('savedEvents'),
        AsyncStorage.getItem('volunteers'),
      ]);
      
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        const volunteers = storedVolunteers ? JSON.parse(storedVolunteers) : [];
        
        // Calculate volunteer counts for each event
        const eventsWithVolunteers = parsedEvents.map((event: Event) => {
          const eventVolunteers = volunteers.filter((v: Volunteer) => 
            v.assignedEvents && v.assignedEvents.includes(event.id)
          );
          return {
            ...event,
            currentVolunteers: eventVolunteers.length,
            maxVolunteers: event.maxVolunteers || 10,
          };
        });
        setEvents(eventsWithVolunteers);
      }
      
      if (savedEvents) {
        const parsedSavedEvents = JSON.parse(savedEvents);
        setSavedIds(parsedSavedEvents.map((e: Event) => e.id));
      }
      
      if (storedVolunteers) {
        setVolunteers(JSON.parse(storedVolunteers));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Function to update volunteer count for a specific event
  const updateEventVolunteerCount = async (eventId: string) => {
    try {
      const [storedEvents, storedVolunteers] = await Promise.all([
        AsyncStorage.getItem('events'),
        AsyncStorage.getItem('volunteers')
      ]);

      if (storedEvents && storedVolunteers) {
        const parsedEvents = JSON.parse(storedEvents);
        const volunteers = JSON.parse(storedVolunteers);
        
        // Find the specific event and update its volunteer count
        const updatedEvents = parsedEvents.map((event: Event) => {
          if (event.id === eventId) {
            const eventVolunteers = volunteers.filter((v: Volunteer) => 
              v.assignedEvents && v.assignedEvents.includes(eventId)
            );
            return {
              ...event,
              currentVolunteers: eventVolunteers.length,
              maxVolunteers: event.maxVolunteers || 10,
            };
          }
          return event;
        });

        // Update events in state and storage
        setEvents(updatedEvents);
        await AsyncStorage.setItem('events', JSON.stringify(updatedEvents));
      }
    } catch (error) {
      console.error('Error updating volunteer count:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add real-time updates for volunteer counts
  useEffect(() => {
    const checkForVolunteerUpdates = async () => {
      try {
        const [storedEvents, storedVolunteers] = await Promise.all([
          AsyncStorage.getItem('events'),
          AsyncStorage.getItem('volunteers')
        ]);

        if (storedEvents && storedVolunteers) {
          const parsedEvents = JSON.parse(storedEvents);
          const volunteers = JSON.parse(storedVolunteers);
          
          // Update volunteer counts for each event
          const eventsWithVolunteers = parsedEvents.map((event: Event) => {
            const eventVolunteers = volunteers.filter((v: Volunteer) => 
              v.assignedEvents && v.assignedEvents.includes(event.id)
            );
            return {
              ...event,
              currentVolunteers: eventVolunteers.length,
              maxVolunteers: event.maxVolunteers || 10,
            };
          });

          // Update events state if there are changes
          setEvents(eventsWithVolunteers);
        }
      } catch (error) {
        console.error('Error checking for volunteer updates:', error);
      }
    };

    // Check for updates every second
    const interval = setInterval(checkForVolunteerUpdates, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (event: Event) => {
    try {
      console.log('Saving event:', event.id);
      const saved = await AsyncStorage.getItem('savedEvents');
      let savedEvents: Event[] = saved ? JSON.parse(saved) : [];
      console.log('Current saved events:', savedEvents.length);
      
      const existingEventIndex = savedEvents.findIndex(e => e.id === event.id);
      
      if (existingEventIndex === -1) {
        // Save the complete event data
        const eventToSave = {
          ...event,
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time,
          description: event.description,
          location: event.location,
          coverPhoto: event.coverPhoto,
          tags: event.tags || [],
          volunteerCategories: event.volunteerCategories || [],
          currentVolunteers: event.currentVolunteers,
          maxVolunteers: event.maxVolunteers,
          canceled: event.canceled
        };
        savedEvents.push(eventToSave);
        console.log('Adding event to saved events');
        await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
        setSavedIds(prev => [...prev, event.id]);
        console.log('Event saved successfully');
      } else {
        // Remove from saved events if already saved
        savedEvents.splice(existingEventIndex, 1);
        console.log('Removing event from saved events');
        await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
        setSavedIds(prev => prev.filter(id => id !== event.id));
        console.log('Event removed successfully');
      }

      // Verify the save
      const verifySaved = await AsyncStorage.getItem('savedEvents');
      const verifyEvents = verifySaved ? JSON.parse(verifySaved) : [];
      console.log('Verified saved events:', verifyEvents.length);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  // Add real-time updates for saved events
  useEffect(() => {
    const checkForSavedUpdates = async () => {
      try {
        const saved = await AsyncStorage.getItem('savedEvents');
        if (saved) {
          const savedEvents = JSON.parse(saved);
          const newSavedIds = savedEvents.map((e: Event) => e.id);
          if (JSON.stringify(newSavedIds) !== JSON.stringify(savedIds)) {
            console.log('Updating saved IDs:', newSavedIds);
            setSavedIds(newSavedIds);
          }
        }
      } catch (error) {
        console.error('Error checking for saved updates:', error);
      }
    };

    const interval = setInterval(checkForSavedUpdates, 1000);
    return () => clearInterval(interval);
  }, [savedIds]);

  const checkVolunteerStatus = async (eventId: string) => {
    try {
      // Check if volunteer is already approved for this event
      const existingVolunteer = volunteers.find(
        v => v.email === user?.email && v.assignedEvents.includes(eventId)
      );
      if (existingVolunteer) {
        return 'approved';
      }

      // Check if volunteer has a pending request
      const pendingVolunteersStr = await AsyncStorage.getItem('pendingVolunteers');
      if (pendingVolunteersStr) {
        const pendingVolunteers: PendingVolunteer[] = JSON.parse(pendingVolunteersStr);
        const pendingRequest = pendingVolunteers.find(
          v => v.eventId === eventId && 
               v.volunteerEmail === user?.email && 
               v.status === 'pending'
        );
        if (pendingRequest) {
          return 'pending';
        }
      }

      return 'none';
    } catch (error) {
      console.error('Error checking volunteer status:', error);
      return 'error';
    }
  };

  const handleEventPress = async (event: Event) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to volunteer for events.');
      return;
    }

    const status = await checkVolunteerStatus(event.id);
    if (status === 'approved') {
      Alert.alert('Notice', 'You are already volunteering for this event.');
      return;
    }
    if (status === 'pending') {
      Alert.alert('Notice', 'You already have a pending request for this event.');
      return;
    }
    if (status === 'error') {
      Alert.alert('Error', 'Unable to check volunteer status. Please try again.');
      return;
    }
    Alert.alert(
      'Register for Event',
      'Do you want to register for this event?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'default', onPress: () => {
            setSelectedEvent(event);
            setShowPositionModal(true);
          }
        },
      ]
    );
  };

  const handlePositionSelect = async (position: string) => {
    if (!selectedEvent || !user) return;

    try {
      // Get existing pending volunteers
      const pendingVolunteersStr = await AsyncStorage.getItem('pendingVolunteers');
      let pendingVolunteers: PendingVolunteer[] = pendingVolunteersStr 
        ? JSON.parse(pendingVolunteersStr) 
        : [];

      // Create new volunteer request
      const newVolunteer: PendingVolunteer = {
        id: Date.now().toString(),
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        volunteerName: `${user.firstName} ${user.lastName}`,
        volunteerEmail: user.email,
        status: 'pending',
        timestamp: Date.now(),
        position: position,
      };

      // Add to pending volunteers
      pendingVolunteers.push(newVolunteer);
      await AsyncStorage.setItem('pendingVolunteers', JSON.stringify(pendingVolunteers));

      // Update the volunteer count for this event
      await updateEventVolunteerCount(selectedEvent.id);

      Alert.alert(
        'Success', 
        `Your volunteer request for ${position} has been submitted for approval. The admin will review your request.`
      );
    } catch (error) {
      console.error('Error submitting volunteer request:', error);
      Alert.alert('Error', 'Failed to submit volunteer request. Please try again.');
    } finally {
      setShowPositionModal(false);
      setSelectedEvent(null);
    }
  };

  const handleRegister = (event: Event) => {
    if ((event.currentVolunteers ?? 0) >= (event.maxVolunteers ?? 0)) {
      Alert.alert('Event Full', 'This event has reached its volunteer limit and is now closed.');
      return;
    }
    // ... existing registration logic ...
  };

  const renderPositionModal = () => {
    if (!selectedEvent) return null;
    return (
      <Modal visible={showPositionModal} transparent animationType="slide">
        <View style={styles.modalContainerCustom}>
          <View style={styles.modalContentCustom}>
            <Text style={styles.modalTitleCustom}>Select Volunteer Position</Text>
            <Text style={styles.modalSubtitleCustom}>for {selectedEvent.title}</Text>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {selectedEvent.volunteerCategories.map((position) => (
                <TouchableOpacity
                  key={position}
                  style={[
                    styles.categoryItemCustom,
                    selectedPosition === position && styles.selectedCategoryItemCustom
                  ]}
                  onPress={() => setSelectedPosition(position)}
                >
                  <Text style={[
                    styles.categoryTextCustom,
                    selectedPosition === position && styles.selectedCategoryTextCustom
                  ]}>{position}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.cancelButtonCustom, { flex: 1 }]}
                onPress={() => {
                  setShowPositionModal(false);
                  setSelectedEvent(null);
                  setSelectedPosition(null);
                }}
              >
                <Text style={styles.cancelButtonTextCustom}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.changeButtonCustom, { flex: 1, opacity: selectedPosition ? 1 : 0.5 }]}
                disabled={!selectedPosition}
                onPress={async () => {
                  if (selectedPosition) {
                    await handlePositionSelect(selectedPosition);
                    setSelectedPosition(null);
                  }
                }}
              >
                <Text style={styles.changeButtonTextCustom}>Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Filter events by search and tag
  const getFilteredEvents = () => {
    // First filter out canceled events
    let filtered = events.filter(e => !e.canceled);
    
    // Then apply search filter
    if (search.trim()) {
      filtered = filtered.filter(e => e.title.toLowerCase().includes(search.trim().toLowerCase()));
    }
    
    // Then apply tag filter
    if (tagFilter.length > 0) {
      filtered = filtered.filter(e => tagFilter.every(tag => (e.tags ?? []).includes(tag)));
    }
    
    // Sort by id (timestamp) descending so newest is first
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    return filtered;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <HeaderBanner />
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons name="person-circle" size={32} color="#62A0A5" />
        </View>
        <View>
          <Text style={styles.title}>Welcome, {user?.firstName || 'Volunteer'}!</Text>
          <Text style={styles.subtitle} numberOfLines={2} allowFontScaling={false}>Find and join events that match your interests</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.container}>
        {/* Search Bar */}
        <TextInput
          style={styles.searchBar}
          placeholder="Search events by title..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
        {/* Tag Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterBar} contentContainerStyle={styles.tagFilterBarContent}>
          {TAG_OPTIONS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagBadge, tagFilter.includes(tag) && styles.tagBadgeSelected]}
              onPress={() => {
                if (tagFilter.includes(tag)) {
                  setTagFilter(tagFilter.filter(t => t !== tag));
                } else {
                  setTagFilter([...tagFilter, tag]);
                }
              }}
            >
              <Text style={[styles.tagText, tagFilter.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
            </TouchableOpacity>
          ))}
          {tagFilter.length > 0 && (
            <TouchableOpacity style={styles.clearTagsButton} onPress={() => setTagFilter([])}>
              <Text style={styles.clearTagsText}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <FlatList
          data={getFilteredEvents()}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.eventContainer}>
              <View style={styles.eventCardContainer}>
                <UnifiedEventCard
                  title={item.title}
                  date={item.date}
                  time={item.time}
                  location={item.location}
                  description={item.description}
                  tags={item.tags}
                  coverPhoto={item.coverPhoto}
                  volunteerCount={item.currentVolunteers}
                  maxVolunteers={item.maxVolunteers}
                  showVolunteerCount={true}
                  canceled={item.canceled}
                  showFullSlot={!item.canceled && (item.currentVolunteers ?? 0) >= (item.maxVolunteers ?? 0)}
                  style={styles.eventCard}
                  locationCoordinates={item.locationCoordinates}
                  saveButton={
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleSave(item);
                      }}
                      style={styles.saveButton}
                      disabled={item.canceled}
                    >
                      <Ionicons
                        name={savedIds.includes(item.id) ? 'bookmark' : 'bookmark-outline'}
                        size={28}
                        color={savedIds.includes(item.id) ? '#62A0A5' : '#aaa'}
                      />
                    </TouchableOpacity>
                  }
                  actionButton={
                    !item.canceled && (
                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => handleEventPress(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.applyButtonText}>Apply</Text>
                      </TouchableOpacity>
                    )
                  }
                />
              </View>
            </View>
          )}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No events available</Text>
            </View>
          }
        />
        {renderPositionModal()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFEAB8',
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },

  headerCard: {
    backgroundColor: '#62A0A5',
    borderRadius: 25,
    padding: 24,
    margin: 16,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    gap: 5,
  },

  headerIcon: {
    backgroundColor: '#FFF1C7',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF1C7',
    marginBottom: 4,
  },
  
  subtitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  divider: {
    height: 3,
    backgroundColor: '#62A0A5',
  },

  eventContainer: {
    width: '100%',
    marginBottom: 15,
  },

  eventCardContainer: {
    width: '100%',
  },

  eventCard: {
    width: '100%',
  },

  saveButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  eventsList: {
    paddingTop: 20,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },

  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 10,
    fontStyle: 'italic',
  },

  modalContainerCustom: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  modalContentCustom: {
    backgroundColor: '#7BB1B7',
    padding: 24,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderWidth: 3,
    borderColor: '#7F4701',
    alignItems: 'center',
    minHeight: 200,
  },

  modalTitleCustom: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF1C7',
    marginBottom: 4,
  },

  modalSubtitleCustom: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.92,
    marginBottom: 16,
  },

  categoryItemCustom: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF1C7',
    width: '100%',
  },

  categoryTextCustom: {
    fontSize: 16,
    color: '#FFF1C7',
  },

  selectedCategoryItemCustom: {
    backgroundColor: 'rgb(113, 165, 174)',
    borderRadius: 10,
  },

  selectedCategoryTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
  },

  cancelButtonCustom: {
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 0,
  },

  cancelButtonTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  changeButtonCustom: {
    backgroundColor: '#7AA47D',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 0,
  },

  changeButtonTextCustom: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  searchBar: {
    borderWidth: 2,
    borderColor: '#7F4701',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
    marginTop: 15,
    backgroundColor: '#fff',
    color: '#333',
  },

  tagFilterBar: {
    marginBottom: 10,
    maxHeight: 44,
  },

  tagFilterBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 8,
  },

  tagBadge: {
    borderWidth: 2,
    backgroundColor: '#FEBD6B',
    borderRadius: 20,
    borderColor: '#7F4701',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 10,
    marginTop: 10,
    height: 35,
  },

  tagBadgeSelected: {
    backgroundColor: '#218686',
  },

  tagText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  tagTextSelected: {
    color: '#fff',
  },

  clearTagsButton: {
    backgroundColor: '#eee',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 8,
  },
  
  clearTagsText: {
    color: '#7F4701',
    fontWeight: 'bold',
    fontSize: 15,
  },

  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1C7',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#7F4701',
    height: 40,
    width: 150,
    flex: 1,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#7F4701',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },
});
