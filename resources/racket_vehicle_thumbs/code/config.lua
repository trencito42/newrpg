RacketThumbs = {
    -- Docker bind-mounts output to panel/public/vehicles. These paths MUST stay
    -- inside this resource because the FiveM filesystem sandbox blocks outside writes.
    OutputDir = 'output',
    RawDir = 'raw',
    Studio = vector3(0.0, 0.0, 900.0),
    StudioHalfSize = 40.0,
    StudioHeight = 32.0,
    CameraFov = 35.0,
    CameraAzimuth = 45.0,
    CameraElevation = 0.27,
    CameraFill = 0.72,
    SettleMs = 2500,
    BgSettleMs = 150,    -- wait after switching background color before capture
    ModelLoadTimeoutMs = 12000,
    CaptureTimeoutMs = 20000,
    ProcessingTimeoutMs = 20000,
    PaddingPixels = 24,
    MinAdminLevel = 5,
    Debug = false,
    KeepVehicleInDebug = false,
}
