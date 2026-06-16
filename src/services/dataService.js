export async function getMigrationRoutes() {

  try {

    const response = await fetch(
      `${import.meta.env.BASE_URL}data/migration-routes.json`
    );

    if (!response.ok) {
      throw new Error("Migration routes not available");
    }

    return await response.json();

  } catch (error) {

    console.error(error);

    return [];
  }
}

export async function getFocusRegions() {

  try {

    const response = await fetch(
      `${import.meta.env.BASE_URL}data/focus-regions.json`
    );

    if (!response.ok) {
      throw new Error("Focus regions not available");
    }

    return await response.json();

  } catch (error) {

    console.error(error);

    return [];
  }
}

export async function getConfig() {

  try {

    const response = await fetch(
      `${import.meta.env.BASE_URL}config.json`
    );

    if (!response.ok) {
      throw new Error("Configuration not available");
    }

    return await response.json();

  } catch (error) {

    console.error(error);

    return {};
  }
}
