import { google } from 'googleapis';
import { Event } from './openai';

interface GoogleApiError {
  code?: number;
  response?: {
    status?: number;
    data?: Record<string, unknown>;
  };
  message?: string;
}

// Function to refresh an access token using the refresh token
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing OAuth client credentials');
      return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error refreshing access token:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function addEventsToCalendar(accessToken: string, events: Event[], refreshToken?: string): Promise<string[]> {
  try {
    console.log('Adding events to calendar with access token length:', accessToken.length);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const eventIds: string[] = [];
    const errors: string[] = [];
    
    for (const event of events) {
      try {
        // Validate event data
        if (!event.title) {
          errors.push(`Event missing title: ${JSON.stringify(event)}`);
          continue;
        }
        
        if (!event.startDate) {
          errors.push(`Event missing start date: ${event.title}`);
          continue;
        }
        
        const calendarEvent = {
          summary: event.title,
          description: event.description || '',
          start: event.isAllDay 
            ? { date: event.startDate.split('T')[0] } 
            : { dateTime: event.startDate },
          end: event.endDate 
            ? (event.isAllDay 
              ? { date: event.endDate.split('T')[0] } 
              : { dateTime: event.endDate })
            : (event.isAllDay 
              ? { date: event.startDate.split('T')[0] } 
              : { dateTime: event.startDate }),
          location: event.location || '',
        };
        
        console.log(`Adding event to calendar: ${event.title}`);
        
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: calendarEvent,
        });
        
        if (response.data.id) {
          eventIds.push(response.data.id);
          console.log(`Successfully added event: ${event.title} (ID: ${response.data.id})`);
        }
      } catch (error: unknown) {
        const apiError = error as GoogleApiError;
        console.error(`Error adding event "${event.title}" to calendar:`, apiError);
        
        // Add more detailed error information
        if (apiError.response) {
          console.error('Response error data:', apiError.response.data);
          console.error('Response error status:', apiError.response.status);
        }
        
        // If we have a refresh token and the error is due to invalid credentials, try refreshing
        if (refreshToken && isAuthError(apiError)) {
          console.log('Attempting to refresh access token...');
          const newAccessToken = await refreshAccessToken(refreshToken);
          
          if (newAccessToken) {
            console.log('Token refreshed, retrying with new access token');
            // Retry with the new access token
            return addEventsToCalendar(newAccessToken, events);
          }
        }
        
        // Collect error messages
        errors.push(`Failed to add event "${event.title}": ${apiError.message || 'Unknown error'}`);
        
        // Rethrow authentication errors so they can be handled by the caller
        if (isAuthError(apiError)) {
          throw apiError;
        }
      }
    }
    
    // If we have errors but also added some events, return the successful ones
    if (errors.length > 0 && eventIds.length > 0) {
      console.warn(`Added ${eventIds.length} events with ${errors.length} errors:`, errors);
    } else if (errors.length > 0 && eventIds.length === 0) {
      // If we have errors and no successful events, throw an error
      throw new Error(`Failed to add events to calendar: ${errors.join('; ')}`);
    }
    
    return eventIds;
  } catch (error) {
    console.error('Error adding events to calendar:', error);
    throw error;
  }
}

export async function getUserCalendars(accessToken: string, refreshToken?: string) {
  try {
    console.log('Getting user calendars with access token length:', accessToken.length);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    console.log('OAuth2 client credentials set');
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('Calendar API initialized, making request...');
    
    try {
      const response = await calendar.calendarList.list();
      console.log('Calendar list response received:', response.status);
      
      return response.data.items || [];
    } catch (error: unknown) {
      const apiError = error as GoogleApiError;
      console.error('Error getting user calendars:', apiError);
      
      // Add more detailed error information
      if (apiError.response) {
        console.error('Response error data:', apiError.response.data);
        console.error('Response error status:', apiError.response.status);
      }
      
      // If we have a refresh token and the error is due to invalid credentials, try refreshing
      if (refreshToken && isAuthError(apiError)) {
        console.log('Attempting to refresh access token...');
        const newAccessToken = await refreshAccessToken(refreshToken);
        
        if (newAccessToken) {
          console.log('Token refreshed, retrying with new access token');
          // Retry with the new access token
          return getUserCalendars(newAccessToken);
        }
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Error in getUserCalendars:', error);
    throw error;
  }
}

// Helper function to check if an error is an authentication error
function isAuthError(error: GoogleApiError): boolean {
  return !!(
    error.code === 401 ||
    (error.response && error.response.status === 401) ||
    (error.message && error.message.includes('invalid_grant'))
  );
} 